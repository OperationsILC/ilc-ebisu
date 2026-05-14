export default function CompaniesHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Companies</h1>
			<p>
				Every external organization Ebisu touches lives in <code>companies</code>: clients,
				general contractors, designers, manufacturers, rep firms. The same company can play
				multiple roles — LOGIQ SUPPLY, for example, is both a manufacturer and a rep firm.
			</p>

			<h2>Roles</h2>
			<p>
				Roles are multi-select. Tick all that apply on the company&apos;s edit page. The role
				determines what dropdowns the company appears in across the rest of the app:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><strong>Manufacturer</strong> — the entity that physically makes the fixtures. Products on the QAP are scoped to a manufacturer + catalog #.</li>
				<li><strong>Rep firm</strong> — the entity ILC actually places POs with. Reps handle one or more manufacturers in a given territory.</li>
				<li><strong>Client</strong> — who pays ILC. Appears on invoices.</li>
				<li><strong>GC</strong> — general contractor. Often the delivery contact and field point of contact.</li>
				<li><strong>Designer</strong> — the architect or interior designer firm.</li>
			</ul>

			<h2>QBO mapping</h2>
			<p>
				Every company that sends or receives money via ILC&apos;s books needs a QBO link.
				There are two separate IDs:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>QBO Customer ID</strong> — for AR. When ILC invoices this company, QBO
					needs this ID to know which Customer the invoice is for.
				</li>
				<li>
					<strong>QBO Vendor ID</strong> — for AP. When ILC receives a bill from this
					company, QBO needs this ID to attribute the payable correctly.
				</li>
			</ul>
			<p>
				The same company can have both populated. When the QBO push integration ships, the
				first push for any unmapped company will search QBO by name, present matches to the PM,
				and store the picked ID. You can also paste an ID in manually if you know it.
			</p>
			<p style={{ padding: '8px 12px', background: '#fff5e0', border: '1px solid #e0c890', borderRadius: '4px' }}>
				<strong>Case-sensitive:</strong> the QBO match is exact. &quot;Logiq Supply&quot; and
				&quot;LOGIQ SUPPLY&quot; are different rows in QBO. Use whatever capitalization the
				QBO record uses.
			</p>

			<h2>Email routing</h2>
			<p>Two emails per company set the default destinations for outbound mail:</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Quote email(s)</strong> — where RFQs go when ILC requests pricing. Comma-separated for multiple recipients.
				</li>
				<li>
					<strong>Order email(s)</strong> — where POs go when ILC places an order.
				</li>
			</ul>
			<p>
				Projects can override these. If a particular project has a different rep contact (a
				PM assigned to that job specifically), set the project-level email override and the
				company-default is bypassed for that project.
			</p>

			<h2>Address &amp; contact</h2>
			<p>
				The address fields on a company are the company&apos;s general address. Project-specific
				delivery addresses and job site addresses live on the project itself — they often differ
				per job and shouldn&apos;t be tied to the company record.
			</p>

			<h2>Commercial terms</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Payment terms (days)</strong> — net N, e.g. 30. Currently informational;
					future invoice automation may use it to suggest a due date.
				</li>
				<li>
					<strong>FFA</strong> — Free Freight Allowance. The threshold over which the
					manufacturer covers freight. Currently informational.
				</li>
				<li>
					<strong>Credit limit</strong> — what we&apos;ve extended this company. Informational.
				</li>
			</ul>

			<h2>Parent company</h2>
			<p>
				If a company is a subsidiary or office of another (e.g. a regional branch), set the
				parent here. Currently informational — future reporting may roll up by parent.
			</p>

			<h2>Manufacturer → rep firm mapping</h2>
			<p>
				On a company tagged as <strong>Manufacturer</strong>, an extra panel appears: <strong>Rep
				firms representing this manufacturer</strong>. Tick every rep firm that handles this
				manufacturer in your market. This drives the auto-grouping when you click{' '}
				<strong>Create POs from SO</strong> — Ebisu groups order lines by manufacturer, looks
				up the rep firm here, and creates one PO per rep firm.
			</p>
			<p>
				If a manufacturer isn&apos;t mapped to any rep firm, its lines fall through to{' '}
				<strong>LOGIQ SUPPLY</strong> by default. You can change that default later by mapping
				the manufacturer to a different rep firm here, or by manually moving the PO post-creation.
			</p>

			<h2>Creating a new company</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Companies → <strong>+ New company</strong>.</li>
				<li>
					Enter the name <em>exactly</em> as it appears in QBO, case and all. This matters if
					this company will ever send or receive money — the QBO search is case-sensitive.
				</li>
				<li>
					Tick the roles. You can always come back and adjust.
				</li>
				<li>
					Fill in QBO Customer ID and/or Vendor ID if you know them. Leave blank otherwise —
					you can paste them in later, or the first push will look them up by name.
				</li>
				<li>
					Email routing, address, terms, parent — fill in what&apos;s relevant. Most fields
					are optional.
				</li>
				<li>Save. You land on the company&apos;s edit page.</li>
			</ol>

			<h2>Editing or deleting</h2>
			<p>
				Click any company name from the list to edit. There&apos;s no delete button by design —
				companies are referenced by many other records (POs, invoices, etc.) and deleting
				orphans those references. If a company should no longer be used, edit the name to
				something like &quot;(disused) ORIGINAL NAME&quot; or leave it as-is and let it fade.
			</p>

			<h2>Searching</h2>
			<p>
				The Companies list page has a name search (case-insensitive, substring match) and a
				role filter. Search and filter combine — &quot;Logiq&quot; + role:rep_firm finds Logiq
				when acting as a rep, even if it&apos;s also a manufacturer.
			</p>
		</>
	);
}
