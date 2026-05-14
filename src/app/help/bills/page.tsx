export default function BillsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Bills (from vendors)</h1>
			<p>
				A bill is what a vendor charges ILC for. Most bills come from manufacturer rep firms
				against a PO we issued; some come from misc. vendors (freight, warehousing, etc.). Every
				bill is reviewed by a PM before it pushes to QBO.
			</p>

			<h2>The two ways bills arrive</h2>
			<h3>Via DocParser (automatic)</h3>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Manufacturer emails their bill PDF to ILC&apos;s bills-inbox address (the email
					address Olivia / accounting forwards to DocParser).
				</li>
				<li>
					DocParser OCRs the PDF and extracts fields: PO number, vendor name, bill date, due
					date, total, line items.
				</li>
				<li>
					DocParser POSTs the extracted JSON to Ebisu&apos;s webhook at{' '}
					<code>/api/bills/inbound</code>. Ebisu creates a <code>bills</code> row with
					status <code>pending_review</code>.
				</li>
				<li>
					Ebisu tries to auto-match the bill to the PO (by PO#) and the vendor (by name,
					case-sensitive). If both match, the bill appears on{' '}
					<code>/projects/[that-project]/bills</code>. If the PO can&apos;t be matched, it
					lands in the <a href="/bills">global Bills inbox</a> as &quot;unmatched&quot; — you
					attach it to a PO before approving.
				</li>
			</ol>

			<h3>Manual entry</h3>
			<p>
				For bills that arrived outside DocParser (a PM forwarded one, or a misc. vendor sent
				something), use the project&apos;s Bills page and click <strong>+ New bill</strong>.
				Fill in vendor bill #, total, dates, and lines manually.
			</p>

			<h2>The reviewer&apos;s workflow</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Find pending bills.</strong> The Bills inbox shows everything with status{' '}
					<code>pending_review</code> at the top, with unmatched bills highlighted red.
				</li>
				<li>
					<strong>Open the bill.</strong> The workbench shows the extracted fields side by
					side with the PO&apos;s lines (for reference). The original PDF link is at the
					bottom — keep that open in another tab while you review.
				</li>
				<li>
					<strong>Attach to PO if not already.</strong> Enter the PO number in the orange
					&quot;No PO attached yet&quot; banner. The text input has autocomplete from the list
					of all POs.
				</li>
				<li>
					<strong>Verify the lines.</strong> Compare bill catalog numbers and quantities to
					the &quot;For reference&quot; PO lines panel below. DocParser sometimes misses lines
					or mis-OCRs digits — fix them. Add, edit, or delete lines as needed.
				</li>
				<li>
					<strong>Check reconciliation.</strong> A yellow banner appears if the bill total
					doesn&apos;t match the sum of line totals (off by more than $0.01). If the bill says
					$12,400 but your lines add up to $12,300, something&apos;s missing or wrong.
				</li>
				<li>
					<strong>Approve or reject.</strong>
					<ul>
						<li>
							<strong>Approve</strong> — fields lock, the bill queues for QBO push. (Push
							itself is the next chunk of work; for now &quot;approved&quot; is the end of
							the Ebisu workflow.) An audit trail records who approved and when.
						</li>
						<li>
							<strong>Reject</strong> — bill is marked rejected with the reason captured.
							Use this when the bill is wrong and you&apos;re sending it back to the vendor.
						</li>
					</ul>
				</li>
			</ol>

			<h2>Why bills have to attach to a PO</h2>
			<p>
				Three-way matching: PO + shipment + bill. If the bill doesn&apos;t reference an
				Ebisu PO, we can&apos;t verify the vendor is charging what we agreed to. The system
				blocks approval until a PO is attached so the link is always recoverable.
			</p>

			<h2>The DocParser raw extraction</h2>
			<p>
				At the bottom of every bill detail page is an expandable <strong>DocParser raw
				extraction</strong> section. Click to see what DocParser actually sent us. Useful when:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>A field looks wrong and you want to know if the OCR caught it.</li>
				<li>You&apos;re debugging why a bill didn&apos;t auto-match a PO.</li>
				<li>
					You want to compare what was extracted versus what the manufacturer&apos;s PDF
					actually says.
				</li>
			</ul>

			<h2>Numbering</h2>
			<p>
				Bills get an internal Ebisu number like <code>BL00123</code>. The vendor&apos;s own
				bill number is separately recorded in <strong>Vendor bill #</strong> (free text — what
				the vendor calls it on their PDF). Both go to QBO when pushed; the vendor bill # is
				what appears on accounting reports.
			</p>

			<h2>What happens after approval</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Status flips to <code>approved</code> and the bill locks.</li>
				<li>
					QBO push (when built) fires: Ebisu creates a Bill in QBO referencing the matched
					Vendor. <code>qbo_id</code> on the bill is filled in.
				</li>
				<li>Accounting schedules the payment in QBO.</li>
				<li>
					When QBO marks the bill paid, status flips to <code>paid</code>. (This sync is part
					of the future QBO integration.)
				</li>
			</ol>

			<h2>Common situations</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>The PO# on the bill doesn&apos;t match any Ebisu PO.</strong></dt>
				<dd>
					Probably a TrackVia-era PO. Attach manually to the closest match if there is one,
					or reject the bill back to the vendor asking them to reissue against the current PO.
				</dd>
				<dt><strong>The vendor over-billed.</strong></dt>
				<dd>
					Reject. Reason: &quot;Bill total $X but PO is $Y; please reissue with correct
					total.&quot; Or, less hostile: edit the lines down to what should be billed and
					approve, then handle the discrepancy in QBO with a credit memo.
				</dd>
				<dt><strong>The bill covers items we haven&apos;t received yet.</strong></dt>
				<dd>
					Approve when you&apos;re comfortable that the items will arrive. Accounting can
					hold payment until receipt independently in QBO.
				</dd>
				<dt><strong>DocParser missed a line on a Logiq bill.</strong></dt>
				<dd>
					Known issue — Sean noted DocParser is imperfect on Logiq specifically. Just add
					the missing line manually before approving.
				</dd>
			</dl>
		</>
	);
}
