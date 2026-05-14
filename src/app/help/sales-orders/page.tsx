export default function SalesOrdersHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Sales Orders</h1>
			<p className="muted">Stub. Full SO guide coming.</p>

			<h2>Quick mechanics</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					An SO represents one quote to the client. Lines snapshot from the QAP via the
					<strong> Add lines from QAP</strong> panel.
				</li>
				<li>
					The SO has its own per-document overrides for margin %, freight %, warehousing %,
					sales tax %, freight override $, and additional freight $. These start as copies of
					the project defaults; edit on the SO without changing the project.
				</li>
				<li>
					Totals on the SO workbench compute live as you edit: QTY total, DN subtotal, CN
					subtotal, freight $, warehousing $, tax $, CN grand total.
				</li>
				<li>
					When the SO is approved, click <strong>Create POs from SO</strong>. Ebisu groups
					the SO&apos;s lines by manufacturer → rep firm (using the manufacturer_rep mapping
					on companies), creates one PO per rep firm, and attaches the lines via{' '}
					<code>order_lines.purchase_order_id</code>. After this, edits to line qty/price
					automatically flow to both the SO and PO because they share the row.
				</li>
				<li>
					Click <strong>+ New invoice from this SO</strong> to bill the client for delivered
					items. See <a href="/help/invoices">invoices</a>.
				</li>
				<li>SO numbers are <code>SO#####</code>.</li>
			</ul>
		</>
	);
}
