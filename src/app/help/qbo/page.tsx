export default function QboHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>QuickBooks Online integration</h1>
			<p>
				Ebisu can push invoices, bills, and change orders into QuickBooks Online so ILC&apos;s
				accounting stays in sync without re-keying. This page covers how the connection works,
				how to set it up, and what the safety rails are.
			</p>

			<h2 id="environments">Two environments: sandbox vs production</h2>
			<p>
				QBO has two completely separate worlds:
			</p>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>Sandbox</strong></dt>
				<dd>
					Intuit&apos;s free demo company. Realistic-ish fake data. Talks to{' '}
					<code>sandbox-quickbooks.api.intuit.com</code>. Authorized by your Intuit Developer
					app&apos;s <em>Development</em> keys. <strong>Cannot</strong> reach the real ILC
					book even if there&apos;s a bug.
				</dd>
				<dt><strong>Production</strong></dt>
				<dd>
					Real QBO companies. Talks to <code>quickbooks.api.intuit.com</code>. Authorized by
					the Intuit Developer app&apos;s <em>Production</em> keys, which Intuit issues only
					after reviewing the app (usually 1–3 business days).
				</dd>
			</dl>
			<p>
				Ebisu&apos;s <code>QBO_ENVIRONMENT</code> env var picks which world the app is in.
				It&apos;s <code>sandbox</code> right now. When production keys land, it flips to{' '}
				<code>production</code>.
			</p>

			<h2 id="dry-run">Dry-run mode</h2>
			<p>
				A second safety lever: <code>QBO_DRY_RUN</code> when <code>true</code> makes every push
				log what it WOULD send without actually firing. Reads are unaffected — searches and
				company lookups still work normally. Default behavior:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><code>QBO_ENVIRONMENT=sandbox</code> → dry-run OFF (real sandbox writes are fine)</li>
				<li><code>QBO_ENVIRONMENT=production</code> → dry-run ON (real ILC writes need explicit opt-in)</li>
			</ul>
			<p>
				Both defaults can be overridden by setting the env var explicitly. The{' '}
				<a href="/qbo">/qbo settings page</a> shows the current state of both at the top.
			</p>

			<h2 id="connect">Connecting</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Open <a href="/qbo">/qbo</a>. If not connected, you see a blue Connect button.
				</li>
				<li>
					Click <strong>Connect to QBO</strong>. Ebisu redirects you to Intuit&apos;s
					authorization page.
				</li>
				<li>
					Sign in with your Intuit account. Pick the QBO company you want to authorize for
					Ebisu. (Sandbox shows your auto-created sandbox company; production shows every real
					company your Intuit account has access to.)
				</li>
				<li>
					Authorize the scopes. Intuit redirects you back to Ebisu with an authorization
					code, Ebisu exchanges it for access + refresh tokens, encrypts them, and stores them
					on a <code>qbo_connections</code> row.
				</li>
				<li>
					You land back on <code>/qbo</code> with a green <em>Connected to QBO</em> flash.
				</li>
			</ol>
			<p>
				Tokens are AES-256-GCM encrypted at rest using <code>QBO_TOKEN_ENC_KEY</code>. Ebisu
				never sees your QBO password.
			</p>

			<h2 id="default-accounts">Default accounts (required before pushing)</h2>
			<p>
				Every QBO Item Ebisu creates needs an <code>IncomeAccountRef</code> (so invoice revenue
				routes correctly) and an <code>ExpenseAccountRef</code> (so bill costs route
				correctly). Missing those was the most likely cause of Tadabase&apos;s fine-grained
				push troubles.
			</p>
			<p>
				After connecting, the <strong>Default accounts</strong> dropdowns on <code>/qbo</code>{' '}
				are populated by querying QBO&apos;s account list. Pick one income account and one
				cogs/expense account, save. Done once per connection.
			</p>

			<h2 id="customer-vendor">Linking companies to QBO records</h2>
			<p>
				QBO has Customers (for AR) and Vendors (for AP). The same legal entity can be both —
				LOGIQ SUPPLY is your vendor for manufacturer bills but might also be a customer of
				something else. Each Ebisu <a href="/companies">company</a> has two QBO ID slots:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<code>qbo_customer_id</code> — populated when you link the company to its QBO
					Customer record. Required before pushing any invoice that lists this company as
					the client.
				</li>
				<li>
					<code>qbo_vendor_id</code> — populated when you link to its QBO Vendor record.
					Required before pushing any bill from this company.
				</li>
			</ul>
			<p>
				To link:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Open a company&apos;s edit page</li>
				<li>Scroll to the <strong>Find in QBO</strong> panel</li>
				<li>
					Two sub-panels, one for Customer and one for Vendor. Type a name in either,
					click Search
				</li>
				<li>
					Pick the match from the results table. Ebisu stores the QBO ID. The matching row
					highlights green next time you reopen the panel.
				</li>
			</ol>
			<p>
				If the search doesn&apos;t find what you&apos;re looking for, expand the{' '}
				<em>Paste an ID manually</em> section and enter the QBO ID directly. Empty value clears
				the link.
			</p>

			<h2 id="items">Products → QBO Items</h2>
			<p>
				When the first invoice involving a product pushes, Ebisu&apos;s{' '}
				<strong>get-or-create</strong> helper handles the Item:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>If the product already has <code>qbo_item_id</code> stored, use it</li>
				<li>Otherwise, query QBO for an Item with matching name (catalog #)</li>
				<li>
					If still not found, create a new NonInventory Item with the connection&apos;s default
					income + cogs account refs
				</li>
				<li>Store the QBO Item ID on the product for idempotent reuse</li>
			</ol>
			<p>
				NonInventory Type is intentional — Ebisu already tracks delivery via Shipments, so we
				don&apos;t want QBO duplicating that with stock counts.
			</p>

			<h2 id="disconnecting">Disconnecting</h2>
			<p>
				<strong>Disconnect</strong> on <code>/qbo</code> revokes the tokens at Intuit (best
				effort) and marks the local connection row inactive. Future pushes will fail with a
				clear &quot;Not connected&quot; error until you reconnect.
			</p>

			<h2 id="switching">Switching from sandbox to production</h2>
			<p>
				When Intuit approves your app and issues production keys:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Add <code>QBO_CLIENT_ID_PRODUCTION</code> and <code>QBO_CLIENT_SECRET_PRODUCTION</code> to Amplify env vars</li>
				<li>Flip <code>QBO_ENVIRONMENT</code> from <code>sandbox</code> to <code>production</code></li>
				<li>(Recommended) Set <code>QBO_DRY_RUN=true</code> for the first deploy</li>
				<li>Trigger a redeploy</li>
				<li>Re-OAuth at <code>/qbo</code> — this time Intuit shows your real QBO companies. Pick the right one.</li>
				<li>Pick default accounts (these are per-environment, so sandbox picks don&apos;t carry over)</li>
				<li>Click into a few real companies and link them via <strong>Find in QBO</strong></li>
				<li>Do a dry-run push of one tiny invoice. Read the logged payload carefully.</li>
				<li>When confident, set <code>QBO_DRY_RUN=false</code>. The next real push goes live.</li>
			</ol>

			<h2 id="errors">Common errors</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><code>QboNotConnectedError: ... Reconnect at /qbo.</code></dt>
				<dd>Refresh token expired (100-day lifetime) or got revoked. Reconnect.</dd>

				<dt><code>QBO connection is missing default income / COGS account references.</code></dt>
				<dd>Pick defaults at /qbo before pushing.</dd>

				<dt>QBO 401 on a push</dt>
				<dd>
					Usually means tokens got revoked between when Ebisu loaded the connection and when
					it tried to push. Reconnect.
				</dd>

				<dt>QBO 400 on Item creation</dt>
				<dd>
					Usually means a required ref (IncomeAccountRef, ExpenseAccountRef) is missing. Check
					the defaults at /qbo. If still failing, the catalog # may have characters QBO
					rejects — names are limited.
				</dd>
			</dl>
		</>
	);
}
