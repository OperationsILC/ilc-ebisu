export default function InvoicesHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Invoices (to clients)</h1>
			<p>
				An invoice is what ILC bills a client for. Invoices come in three flavours:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Product invoice</strong> — for fixtures/controls delivered. Belongs to a
					Sales Order; pulls line items from delivered shipments.
				</li>
				<li>
					<strong>Design fee invoice</strong> — for ILC&apos;s design services. Belongs to a
					project, not an SO. Lines are free-form (description + quantity + unit $).
				</li>
				<li>
					<strong>Credit memo</strong> — when ILC owes the client money (returns,
					over-billing corrections). Also free-form. Records as a negative on the client&apos;s
					ledger.
				</li>
			</ul>

			<h2>Numbering</h2>
			<p>
				All three types share a single <code>IN#####</code> sequence. The system filters by{' '}
				<em>type</em> in the UI; the IDs themselves don&apos;t carry a prefix indicating
				whether the invoice is product/design-fee/credit.
			</p>

			<h2 id="product-invoice">Create a product invoice</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Open the Sales Order the invoice covers.</li>
				<li>
					Top of the SO workbench, click <strong>+ New invoice from this SO</strong>. A blank
					invoice opens.
				</li>
				<li>
					Scroll to <strong>Delivered &amp; uninvoiced</strong>. This panel lists every
					shipment_line on the SO that&apos;s been delivered (shipment status = received)
					minus whatever is already on any invoice.
				</li>
				<li>
					Tick the lines you want to bill. Each row has a default qty equal to the open
					(uninvoiced) qty — adjust if you&apos;re only billing part of it for progress
					billing. Click <strong>Add selected to invoice</strong>.
				</li>
				<li>
					Review the lines (you can delete individual lines while still in draft). Set
					invoice date, due date, optionally a per-invoice client PO #, and override the
					sales tax if the jobsite is in a different jurisdiction.
				</li>
				<li>
					Apply a deposit or credit if the client has one on file (see{' '}
					<a href="#credits">below</a>).
				</li>
				<li>
					Click <strong>Mark sent</strong>. Lines lock. The invoice is now eligible for QBO
					push.
				</li>
				<li>
					Download the PDF and send it to the client however your team sends invoices
					(email, QBO direct, etc.).
				</li>
			</ol>

			<h2 id="design-fee">Create a design-fee invoice</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From the project, click <strong>Invoices</strong>, then{' '}
					<strong>+ Design-fee invoice</strong>.
				</li>
				<li>
					Use the <strong>Add line</strong> form to add lines. Description + qty + unit $ for
					each milestone (e.g. &quot;50% Schematic Design&quot;, qty 1, unit $5,000).
				</li>
				<li>
					Optionally set the <strong>Design phase</strong> field on the header — appears as a
					prominent label on the invoice PDF.
				</li>
				<li>Mark sent. Download PDF. Send.</li>
			</ol>

			<h2 id="credit-memo">Create a credit memo</h2>
			<p>
				Same flow as design fee, but choose <strong>+ Credit memo</strong> instead. The unit $
				is the credit amount per unit. Issue this when you owe the client back — e.g. they
				returned five damaged fixtures and you&apos;ve agreed to credit them.
			</p>

			<h2 id="progress-billing">Progress billing</h2>
			<p>
				One Sales Order can have many invoices. A common pattern:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>Shipment 1 delivers 60 of 100 of a line item.</li>
				<li>
					You create an invoice covering those 60. <em>Delivered &amp; uninvoiced</em>{' '}
					shows the remaining 40 as still open.
				</li>
				<li>
					Shipment 2 delivers the other 40. You create a second invoice covering them. The
					line is now fully invoiced and stops appearing in the uninvoiced panel.
				</li>
			</ul>
			<p>
				If a client wants to pay against milestones rather than deliveries — e.g. they&apos;re
				okay paying 50% on order, 40% on delivery, 10% on commissioning — you can still bill
				piecewise, just enter the qty fractions you want to bill on each invoice.
			</p>

			<h2 id="credits">Deposits and credits</h2>
			<p>
				If a client has paid ahead or has an existing credit, Ebisu surfaces their available
				balance at the bottom of the invoice workbench in the <strong>Apply credit /
				deposit</strong> panel:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Credit to apply</strong> — pulls from the running balance of{' '}
					<code>client_credits</code> rows (deposits + refunds + credit memos + manual
					entries minus everything already applied).
				</li>
				<li>
					<strong>Deposit to apply</strong> — for a deposit specifically allocated to this
					project. Use this for &quot;client paid us $50K up front for this job specifically.&quot;
				</li>
			</ul>
			<p>
				Both come off the <em>Amount due</em> figure. The total invoice amount on the PDF
				still shows the gross.
			</p>

			<h2 id="payment">Recording payment</h2>
			<p>
				Once the invoice is sent, the <strong>Record payment $</strong> field appears at the
				top of the workbench. Enter the amount received (cumulative — if a client pays in two
				installments, enter the running total). Status flips to <code>partial_paid</code> until
				the payment reaches the invoice total, then flips to <code>paid</code>.
			</p>

			<h2 id="qbo">QBO push (not yet built)</h2>
			<p>
				The schema has space for QBO IDs on every invoice (<code>qbo_id</code>) and a separate{' '}
				<code>qbo_status</code> column tracking push lifecycle. The actual push to QuickBooks
				Online is the next chunk of work. When it&apos;s live, sent invoices will queue for
				push automatically, and you&apos;ll see a status badge (<code>● pushed</code>,{' '}
				<code>● failed</code>, etc.) on the invoice list.
			</p>

			<h2>What you can&apos;t do (by design)</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>Edit invoice lines after the invoice has been marked sent.</li>
				<li>Negative qty on a product invoice — use a credit memo instead.</li>
				<li>
					Create a product invoice without an SO. Product lines have to trace back to an order
					line and a shipment line.
				</li>
			</ul>
		</>
	);
}
