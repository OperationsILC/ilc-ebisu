export default function HelpIndexPage() {
	return (
		<>
			<h1>Ebisu help</h1>
			<p>
				Ebisu is the ILC Studios procurement workspace. It tracks lighting projects from
				design-phase budgets through quotes, sales orders, deliveries, and invoicing. This help
				section walks through each piece.
			</p>

			<h2>If you&apos;re new</h2>
			<p>
				Start with <a href="/help/getting-started">Getting started</a>. Then read the topic for
				whatever workflow you&apos;re about to do — they&apos;re short and self-contained.
			</p>

			<h2>The shape of a project</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					<a href="/help/projects">A project is created</a> with the client, GC, designer,
					budget targets, delivery and job-site addresses, and a project manager.
				</li>
				<li>
					Designers build a <a href="/help/qap">QAP</a> (Quantity And Pricing schedule) by
					importing a CSV or editing the grid directly. Every fixture or control on the project
					lives here.
				</li>
				<li>
					When pricing is needed, PMs send <a href="/help/rfqs">RFQs</a> to rep firms and
					push the quoted prices back into the QAP.
				</li>
				<li>
					Once the design is approved, the PM creates a{' '}
					<a href="/help/sales-orders">Sales Order</a> for the client and clicks{' '}
					<strong>Create POs from SO</strong> to generate{' '}
					<a href="/help/purchase-orders">Purchase Orders</a> to manufacturers (one per rep
					firm).
				</li>
				<li>
					As fixtures arrive, the PM logs <a href="/help/shipments">Shipments</a> against POs.
					Partial deliveries are first-class.
				</li>
				<li>
					Delivered items become billable. PMs create progress{' '}
					<a href="/help/invoices">Invoices</a> from the SO covering whatever has been
					delivered but not yet invoiced.
				</li>
				<li>
					Manufacturers email their bills, which arrive via DocParser and land in the{' '}
					<a href="/help/bills">Bills inbox</a>. PMs review, attach the matching PO, approve,
					and the bill pushes to QBO.
				</li>
			</ol>

			<h2>Cross-cutting</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<a href="/help/companies">Companies</a> — every client, vendor, rep firm, designer,
					and GC lives here. The same company can wear multiple hats.
				</li>
				<li>
					<a href="/help/glossary">Glossary</a> — quick definitions: QAP, DN, CN, FFA, etc.
				</li>
			</ul>

			<h2>Conventions</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Document numbering is 2 letters + 5 digits across the board:{' '}
					<code>PO00123</code>, <code>SO00123</code>, <code>IN00123</code>,{' '}
					<code>BL00123</code>, <code>RQ00123</code>, <code>SH00123</code>,{' '}
					<code>CR00123</code>.
				</li>
				<li>
					<strong>DN</strong> = dealer-net (what the manufacturer charges ILC).{' '}
					<strong>CN</strong> = client-net (what ILC charges the client). Margin lives between
					them.
				</li>
				<li>
					Edits to a sales order line update the corresponding purchase order line automatically
					(and vice versa) because they share the same row in the database. No sync logic needed.
				</li>
				<li>
					Internal notes (the ones labelled &quot;never leaves Ebisu&quot;) are never on PDFs,
					never sent in emails, never pushed to QBO. They&apos;re for the team.
				</li>
			</ul>
		</>
	);
}
