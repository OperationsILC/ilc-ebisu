export default function ShipmentsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Shipments &amp; deliveries</h1>
			<p className="muted">Stub. Full shipments guide coming.</p>

			<h2>Quick mechanics</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					A shipment is one physical delivery from a rep firm for one PO. POs can have many
					shipments — manufacturers commonly split deliveries (e.g. 50 now, 50 in six weeks).
				</li>
				<li>
					Each shipment is composed of <strong>shipment lines</strong>, one per PO line
					actually on this delivery, with a <code>qty_shipped</code>. Quantities can be
					partial — &quot;line ordered 100, this shipment has 60, next shipment will cover the
					rest.&quot;
				</li>
				<li>
					Statuses: <code>expected</code> → <code>in_transit</code> →{' '}
					<code>received</code>. Also <code>partial</code> (arrived but short) and{' '}
					<code>cancelled</code>.
				</li>
				<li>
					<strong>Mark received</strong> is a one-click action that flips status, auto-stamps
					<code> received_date</code> and <code>received_by_user_id</code>, and refreshes the
					RCVD rollup on the parent PO. You can also set the date manually in the header form.
				</li>
				<li>
					The workbench shows every PO line with <strong>Ordered</strong>, <strong>Other
					shipments</strong> (non-cancelled), <strong>Other received</strong>, and{' '}
					<strong>Still open</strong> columns so you know what&apos;s already committed
					elsewhere before entering qty on this shipment.
				</li>
				<li>
					<strong>Over-commit warnings</strong> highlight in red if your entered qty plus
					other-shipment qty exceeds the line&apos;s ordered qty. Allowed but flagged —
					manufacturers do over-ship sometimes.
				</li>
				<li>
					When a shipment is marked received, its lines become eligible to bill on a product
					invoice (see <a href="/help/invoices">invoices</a>).
				</li>
				<li>Shipment numbers are <code>SH#####</code>.</li>
			</ul>
		</>
	);
}
