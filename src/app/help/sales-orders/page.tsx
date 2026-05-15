export default function SalesOrdersHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Sales Orders</h1>
			<p>
				A Sales Order (SO) represents one quote to the client — the lines ILC is committing to
				sell at agreed prices. The SO is also the parent of every Purchase Order that follows,
				because <a href="/help/purchase-orders">POs are created from the SO</a>.
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>draft</code> → <code>confirmed</code> → <code>shipped</code> →{' '}
				<code>invoiced</code> → <code>closed</code>. Also <code>cancelled</code>.
			</p>

			<h2 id="create">Creating an SO</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From the project, click <strong>Sales Orders</strong>, then <strong>+ New SO</strong>.
				</li>
				<li>
					A blank SO opens. The financial defaults (margin, freight, warehousing, sales tax)
					are copied from the project; you can edit them per-SO.
				</li>
				<li>
					Scroll to <strong>Add lines from QAP</strong>. The QAP lines panel is filterable and
					groupable by manufacturer. Tick the lines you want on this SO and click{' '}
					<strong>Add to SO</strong>.
				</li>
				<li>
					Lines snapshot from the QAP — qty, DN, manufacturer, catalog #, type, description.
					From this point, QAP edits don&apos;t affect the SO line. (You can re-add a line
					that&apos;s already on the SO if you want a fresh snapshot.)
				</li>
			</ol>

			<h2 id="totals">Totals</h2>
			<p>The SO workbench computes totals live as you edit. From subtotal to grand total:</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li><strong>Total QTY</strong> — sum of qty across all lines</li>
				<li><strong>DN Subtotal</strong> — sum of (qty × unit_dn) — what ILC pays manufacturers</li>
				<li>
					<strong>CN Subtotal</strong> — sum of (qty × unit_cn) — what ILC charges the
					client. <code>unit_cn = unit_dn × (1 + margin/100)</code> by default but can be
					hand-set per line.
				</li>
				<li>
					<strong>Freight $</strong> — either the freight override $ (if set) or freight% ×
					subtotal. Plus any additional freight $.
				</li>
				<li>
					<strong>Warehousing $</strong> — warehousing % × subtotal.
				</li>
				<li>
					<strong>Tax $</strong> — sales tax % × (subtotal + freight + warehousing).
				</li>
				<li>
					<strong>CN Total</strong> — the grand total the client pays.
				</li>
			</ol>

			<h2 id="line-edits">Editing lines</h2>
			<p>
				Each SO line has editable QTY, QTY type, Unit DN, Unit CN, Margin %, and Rep quote #.
				All save together via the bulk Save button (dirty rows highlight yellow).
			</p>
			<p>
				<strong>Bidirectional sync with PO:</strong> if an SO line is already on a PO, edits to
				qty or unit_dn on the SO update the PO line automatically — and vice versa. This is
				structural: SO and PO reference the same row in <code>order_lines</code>. No sync logic
				needed.
			</p>

			<h3 id="delete-line">Deleting a line</h3>
			<p>
				Use the × button on the right of each row. If the line is already on a PO, it disappears
				from the PO too (FK cascade).
			</p>

			<h2 id="create-pos">Creating POs from the SO</h2>
			<p>
				When the SO is confirmed and you&apos;re ready to order from manufacturers:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Click <strong>Create POs from SO</strong>. Ebisu groups all unassigned SO lines by
					manufacturer → rep firm (using the{' '}
					<a href="/help/companies#manufacturer-rep">manufacturer_rep mapping</a> on companies),
					creates one PO per rep firm, and attaches the lines.
				</li>
				<li>
					Manufacturers without a rep firm mapping fall through to <strong>LOGIQ SUPPLY</strong>{' '}
					as the default. You can move POs to a different rep firm post-creation by editing the
					PO header.
				</li>
				<li>
					The button text shows how many lines aren&apos;t yet on a PO. Click it once early in
					the project, then again later as you add more lines to the SO — only newly-unassigned
					lines get new POs.
				</li>
			</ol>

			<h2 id="invoice">Creating an invoice from the SO</h2>
			<p>
				When fixtures have arrived (logged via <a href="/help/shipments">shipments</a>) and
				you&apos;re ready to bill:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Click <strong>+ New invoice from this SO</strong>. A blank product invoice opens.
				</li>
				<li>
					See <a href="/help/invoices">invoices</a> for the rest of the flow — including the{' '}
					<em>Delivered &amp; uninvoiced</em> panel that&apos;s the heart of progress billing.
				</li>
			</ol>

			<h2 id="downloads">Downloading the SO PDF</h2>
			<p>
				A <strong>Download PDF ↗</strong> link next to the SO number opens a branded PDF the PM
				can email to the client. Totals match what&apos;s on the workbench. Internal notes are{' '}
				<em>not</em> on the PDF.
			</p>

			<h2 id="numbering">Numbering</h2>
			<p>
				SO numbers are <code>SO#####</code> — global sequence across all projects.
			</p>
		</>
	);
}
