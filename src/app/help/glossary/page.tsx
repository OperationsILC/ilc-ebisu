export default function GlossaryHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Glossary</h1>
			<p>Definitions of the terms Ebisu uses, in order from most-used to least.</p>

			<dl style={{ lineHeight: 1.7 }}>
				<dt id="qap"><strong>QAP — Quantity And Pricing</strong></dt>
				<dd>
					The master fixture and control schedule for a project. The QAP is the source of
					truth: every fixture or control that will be ordered exists as a row here, with its
					manufacturer, catalog number, type code, finish, quantity, dealer-net price, and
					margin.
				</dd>

				<dt id="dn"><strong>DN — Dealer Net</strong></dt>
				<dd>
					What the manufacturer (or their rep firm) charges ILC. The wholesale price.
				</dd>

				<dt id="cn"><strong>CN — Client Net</strong></dt>
				<dd>
					What ILC charges the client. <code>CN = DN × (1 + margin)</code>. The retail price.
				</dd>

				<dt id="margin"><strong>Margin</strong></dt>
				<dd>
					The percentage markup from DN to CN. Set at the project level as a default, but
					overrideable per line on each order line.
				</dd>

				<dt id="type"><strong>Type</strong></dt>
				<dd>
					A project-specific short code for a kind of fixture, like <code>A1</code>,{' '}
					<code>W2-ALT</code>, <code>CON-6</code>. Designers use these on drawings.
				</dd>

				<dt id="catalog"><strong>Catalog #</strong></dt>
				<dd>
					The manufacturer&apos;s product number. Scoped to a manufacturer — two different
					manufacturers can have the same catalog # for different products.
				</dd>

				<dt id="rfq"><strong>RFQ — Request For Quote</strong></dt>
				<dd>
					A list of items sent to a rep firm asking them to quote dealer-net pricing.
					Numbered <code>RQ#####</code>.
				</dd>

				<dt id="so"><strong>SO — Sales Order</strong></dt>
				<dd>
					What ILC sells to a client. Lines come from the QAP. Numbered <code>SO#####</code>.
				</dd>

				<dt id="po"><strong>PO — Purchase Order</strong></dt>
				<dd>
					What ILC orders from a manufacturer (via a rep firm). Generated from an SO by
					grouping its lines by manufacturer → rep firm. One PO per rep firm. Numbered{' '}
					<code>PO#####</code>.
				</dd>

				<dt id="co"><strong>CO — Change Order</strong></dt>
				<dd>
					A versioned modification to a PO after it&apos;s been sent. (Not yet built in
					Ebisu; the schema slot exists.) Numbered <code>CO#####</code>.
				</dd>

				<dt id="shipment"><strong>Shipment</strong></dt>
				<dd>
					A physical delivery from a rep firm against a PO. A PO can have many shipments;
					each shipment covers any subset of the PO&apos;s lines at any quantity (partial
					deliveries are first-class). Numbered <code>SH#####</code>.
				</dd>

				<dt id="invoice"><strong>Invoice</strong></dt>
				<dd>
					What ILC bills the client. Three flavours: product (against delivered items),
					design fee (for ILC&apos;s service revenue), credit memo (when ILC owes the client).
					Numbered <code>IN#####</code>.
				</dd>

				<dt id="bill"><strong>Bill</strong></dt>
				<dd>
					What a vendor (usually a rep firm) charges ILC against a PO. Reviewed and approved
					by a PM before pushing to QBO. Numbered <code>BL#####</code>.
				</dd>

				<dt id="credit"><strong>Client credit</strong></dt>
				<dd>
					Money a client has on file with ILC, either from paying ahead, a refund, or a
					credit memo issued by ILC. Can be applied against any invoice for that client to
					reduce the amount due. Numbered <code>CR#####</code>.
				</dd>

				<dt id="qbo"><strong>QBO — QuickBooks Online</strong></dt>
				<dd>
					ILC&apos;s accounting system of record. Invoices and bills push to QBO once
					reviewed and approved. Customer and Vendor records in QBO are matched to Ebisu
					<code> companies </code>by name (case-sensitive) and a stored QBO ID.
				</dd>

				<dt id="ffa"><strong>FFA — Free Freight Allowance</strong></dt>
				<dd>
					The dollar threshold over which a manufacturer covers freight. If your PO total
					exceeds the FFA, the manufacturer eats the shipping cost.
				</dd>

				<dt id="docparser"><strong>DocParser</strong></dt>
				<dd>
					Third-party OCR service that reads manufacturer bill PDFs and posts the extracted
					data to Ebisu&apos;s <code>/api/bills/inbound</code> webhook. Imperfect — PMs always
					review before approving.
				</dd>

				<dt id="rep"><strong>Rep firm</strong></dt>
				<dd>
					An intermediary that represents one or more manufacturers in a regional market.
					ILC places POs with the rep firm, who handles the actual manufacturer fulfillment.
					LOGIQ SUPPLY is ILC&apos;s primary rep firm.
				</dd>

				<dt id="ifc"><strong>IFC — Issued For Construction</strong></dt>
				<dd>
					Milestone in design when drawings are released to the contractor for construction.
					Often the trigger for ordering long-lead items.
				</dd>

				<dt id="phases"><strong>Phases (SD/DD/CD/CA)</strong></dt>
				<dd>
					Schematic Design, Design Development, Construction Documents, Construction
					Administration. The standard architecture/design phases.
				</dd>
			</dl>
		</>
	);
}
