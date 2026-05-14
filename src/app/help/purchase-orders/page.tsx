export default function PurchaseOrdersHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Purchase Orders</h1>
			<p className="muted">Stub. Full PO guide coming.</p>

			<h2>Quick mechanics</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					POs are created from a Sales Order via{' '}
					<strong>Create POs from SO</strong>. You don&apos;t create them by hand. One PO per
					rep firm; lines that share a rep firm group onto the same PO.
				</li>
				<li>
					PO lines are the <em>same database row</em> as the originating SO line. Editing qty
					or unit DN on the PO instantly updates the SO and vice versa. No sync logic needed.
				</li>
				<li>
					Statuses: <code>draft</code> → <code>sent</code> → <code>acknowledged</code> →{' '}
					<code>shipped</code> → <code>received</code> → <code>closed</code>. Also{' '}
					<code>cancelled</code> and the special <code>dont_send</code> (&quot;internal-only
					PO; don&apos;t email the rep&quot;).
				</li>
				<li>
					The first time status flips to <code>sent</code>, Ebisu auto-stamps <code>sentAt</code>.
				</li>
				<li>
					Each PO has its own <strong>Ship-to text</strong> override and <strong>ILC office
					address</strong> override — useful for direct-ship to a jobsite vs. through ILC&apos;s
					warehouse.
				</li>
				<li>
					Per-line <strong>RCVD</strong> column shows received qty + committed-to-future
					shipments qty. Format <code>12+8</code> means 12 actually received and 8 more on
					expected or in-transit shipments. See <a href="/help/shipments">shipments</a>.
				</li>
				<li>
					<strong>Download PDF</strong> generates the branded PO document the rep firm sees.
				</li>
				<li>PO numbers are <code>PO#####</code>.</li>
			</ul>
		</>
	);
}
