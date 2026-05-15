export default function PurchaseOrdersHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Purchase Orders</h1>
			<p>
				A Purchase Order (PO) is what ILC sends to a rep firm to order fixtures. POs are{' '}
				<strong>created from Sales Orders</strong> — never by hand. One PO per rep firm; lines
				that share a rep firm group onto the same PO.
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>draft</code> → <code>sent</code> → <code>acknowledged</code> →{' '}
				<code>shipped</code> → <code>received</code> → <code>closed</code>. Also{' '}
				<code>cancelled</code> and the special <code>dont_send</code>.
			</p>
			<p>
				The first time status flips to <code>sent</code>, Ebisu auto-stamps <code>sentAt</code>{' '}
				— a permanent record of when the order went out.
			</p>

			<h3 id="dont-send"><code>dont_send</code>: &quot;internal-only PO&quot;</h3>
			<p>
				Mason&apos;s convention from Tadabase: sometimes ILC creates a PO that&apos;s really
				just an internal tracking placeholder, not an order to send to the rep. Set status to{' '}
				<code>dont_send</code> and Ebisu will skip the email send if you trigger it.
			</p>

			<h2 id="shared-row">Shared with the SO</h2>
			<p>
				The PO doesn&apos;t copy the SO line — it{' '}
				<strong>is</strong> the same database row (in <code>order_lines</code>) with both an{' '}
				<code>sales_order_id</code> and a <code>purchase_order_id</code>. Edits to qty or unit DN
				on either side instantly update the other. No sync logic, no drift.
			</p>
			<p>
				This is enforced structurally — there&apos;s only one record. The PO workbench shows
				the same line data as the SO workbench, with different headers and totals.
			</p>

			<h2 id="totals">Totals (DN side)</h2>
			<p>
				PO totals are simpler than SO totals — no margin, freight %, warehousing, or tax. Just:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li><strong>Total QTY</strong></li>
				<li><strong>DN Subtotal</strong> — what ILC owes the rep firm for fixtures</li>
				<li><strong>Added freight $</strong> — line item freight on the PO (if any)</li>
				<li><strong>PO Total</strong> — Subtotal + Added Freight</li>
			</ol>

			<h2 id="line-edits">Editing lines</h2>
			<p>
				Same dirty-cell + bulk-save pattern as the SO workbench. The <strong>RCVD</strong>{' '}
				column shows received qty (from delivered shipments) plus the qty committed to upcoming
				shipments. Format <code>12+8</code> means 12 actually received and 8 more on
				expected/in-transit shipments. See <a href="/help/shipments">shipments</a>.
			</p>
			<p>
				Edits sync back to the linked SO automatically.
			</p>

			<h2 id="header">PO header settings</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>Status</strong></dt>
				<dd>The lifecycle state. Updating to <code>sent</code> stamps <code>sentAt</code>.</dd>

				<dt><strong>Tracking #</strong></dt>
				<dd>The freight tracking number once the rep ships.</dd>

				<dt><strong>Ordered date</strong></dt>
				<dd>When the rep confirmed receipt of the PO.</dd>

				<dt><strong>Added freight $</strong></dt>
				<dd>Line item freight charged on this PO (separate from the project&apos;s freight % default — that lives on the SO).</dd>

				<dt><strong>Rep quote #</strong></dt>
				<dd>The rep firm&apos;s own quote reference, when they want the PO to cite one. Per-line rep quote #s also exist on each line.</dd>

				<dt><strong>Ship-to text</strong></dt>
				<dd>
					Free-text override for where the truck delivers. Defaults to the project&apos;s
					delivery address; set this when you want a one-off direct-to-jobsite delivery for
					this PO.
				</dd>

				<dt><strong>ILC office address</strong></dt>
				<dd>Override of the From block on the PDF. Rare; mainly used if a regional ILC office is fulfilling.</dd>

				<dt><strong>Send-from email / Send-to email</strong></dt>
				<dd>
					When ILC emails the PO, who it comes from and where it goes. Defaults to{' '}
					<code>orders@ilcstudios.com</code> and the rep firm&apos;s <code>order_emails</code>.
				</dd>

				<dt><strong>Custom email message</strong></dt>
				<dd>
					Free-text message that appears in the PO email body and as a callout on the PDF.
					Useful for &quot;Please confirm receipt by Friday&quot; or other one-off notes.
				</dd>

				<dt><strong>Internal notes</strong></dt>
				<dd>
					Never on the PDF, never in the email. For freight haggling notes, partial-ship
					strategy, etc.
				</dd>
			</dl>

			<h2 id="version">Version number</h2>
			<p>
				Every PO starts at <code>v1</code>. Change Orders (not yet built) will increment{' '}
				<code>version_no</code> when a sent PO is modified, capturing the as-sent state. For
				now, just edit the live PO if it&apos;s not yet been sent; for sent POs, create a CO
				once that workflow ships.
			</p>

			<h2 id="pdf">Downloading the PO PDF</h2>
			<p>
				The PO PDF is what the rep firm sees. <strong>Download PDF ↗</strong> next to the PO
				number. The PDF includes:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>ILC wordmark + the PO number in orange + date</li>
				<li>Ship-to (PO override or project default) and From (ILC) addresses</li>
				<li>Custom email message as a callout if you set one</li>
				<li>Lines table with type, catalog #, description, qty, UoM, unit DN, line total</li>
				<li>DN totals — subtotal + added freight = PO total</li>
				<li>Notes if set</li>
				<li>Internal notes <em>not</em> on the PDF</li>
			</ul>

			<h2 id="numbering">Numbering</h2>
			<p>
				PO numbers are <code>PO#####</code> — global sequence. Bills that reference a PO number
				on a vendor invoice match against this for auto-attachment in the{' '}
				<a href="/help/bills">bills review flow</a>.
			</p>
		</>
	);
}
