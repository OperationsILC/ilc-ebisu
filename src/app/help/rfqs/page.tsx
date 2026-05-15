export default function RfqsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>RFQs — Requesting Quotes</h1>
			<p>
				An RFQ is a list of items sent to a rep firm asking them to quote dealer-net pricing.
				PMs send RFQs early in the project to refresh the QAP with current pricing before
				committing to a sales order.
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>draft</code> → <code>sent</code> → <code>quoted</code> → <code>accepted</code> or{' '}
				<code>declined</code>. Also <code>cancelled</code>.
			</p>

			<h2 id="create">Creating an RFQ</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From the project, click <strong>RFQs</strong>, then <strong>+ New RFQ</strong>.
				</li>
				<li>
					Pick a rep firm from the dropdown. (Companies tagged role=rep_firm only.) If the rep
					firm isn&apos;t in the list, add it on the <a href="/companies/new" target="_blank">
					Companies page</a> first.
				</li>
				<li>
					Pick the QAP lines you want quotes on. The picker is filterable — search by type,
					catalog #, or manufacturer. You can multi-select.
				</li>
				<li>
					Optionally add notes — these become the body of the email to the rep firm.
				</li>
				<li>Create. You land on the RFQ detail page.</li>
			</ol>

			<h2 id="line-edits">Editing lines</h2>
			<p>
				On the RFQ detail page, the <strong>QTY</strong> field on each line is editable while
				the RFQ is in draft — PMs often want to ask for a slightly different qty than what&apos;s
				on the QAP (rounding up for spares, etc.).{' '}
				<strong>QTY type</strong> (EA, LF, KIT, ...) is also editable; suggestions surface via
				datalist.
			</p>
			<p>
				The other snapshot fields (type, catalog #, manufacturer, description) are locked —
				they reflect the QAP at the moment the RFQ was created.
			</p>

			<h3 id="add-more">Adding more lines after creation</h3>
			<p>
				While the RFQ is in draft, scroll to <strong>Add lines from QAP</strong>. Same filter
				interface as creation; pick more lines and they snapshot onto the RFQ.
			</p>

			<h2 id="send">Sending the RFQ</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Click <strong>Send RFQ</strong>. Ebisu emails the rep firm using their{' '}
					<code>quote_emails</code> (set on the company record). If the project has a{' '}
					<code>emails_for_quotes_so</code> override, that wins.
				</li>
				<li>
					The email body uses Mason&apos;s standard template — a clean line item table plus
					whatever notes you added.
				</li>
				<li>
					In dev environments, <code>DEV_EMAIL_REDIRECT</code> diverts the email to a safe
					address. In production, it goes to the configured rep firm email.
				</li>
				<li>
					Status flips from <code>draft</code> to <code>sent</code>, with <code>sentAt</code>{' '}
					stamped. Lines lock from further editing.
				</li>
			</ol>

			<h2 id="receive">Receiving quotes back</h2>
			<p>
				When the rep firm replies with prices, open the RFQ detail page and enter the{' '}
				<strong>Quoted DN</strong> per line. As you fill in prices, the line shows a delta
				against the QAP&apos;s <code>current_dn</code> (so you can see whether the new price is
				higher or lower than what&apos;s on file).
			</p>

			<h3 id="push-to-qap">Pushing prices to QAP</h3>
			<p>
				For each line with a quoted price, click <strong>Push to QAP</strong>. This copies the
				quoted DN to the corresponding QAP row&apos;s <code>current_dn</code>, recording when
				and by whom on <code>appliedToQapAt</code> and <code>appliedToQapByUserId</code>.
			</p>
			<p>
				If a quote is for an item not on the QAP yet (rep is suggesting an alternate), enter it
				as a manual QAP row first; you can&apos;t push to a QAP row that doesn&apos;t exist.
			</p>

			<h2 id="multiple">Multiple RFQs per project</h2>
			<p>
				An RFQ goes to one rep firm at a time. If two rep firms compete for the same
				manufacturer&apos;s lines, create two RFQs and compare the quoted prices when both come
				back.
			</p>
			<p>
				There&apos;s no automatic &quot;winning rep&quot; logic — the PM picks which quote to
				push to QAP. The other quote stays recorded for future reference.
			</p>

			<h2 id="status">Status changes</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Mark quoted</strong> — once all (or most) lines have quoted prices entered.
					Status moves to <code>quoted</code>. Informational; doesn&apos;t lock anything.
				</li>
				<li>
					<strong>Mark accepted</strong> — when the PM decides this rep&apos;s quote is the
					one. Often accompanied by <em>Push all to QAP</em>.
				</li>
				<li>
					<strong>Mark declined</strong> — the alternative when a competing quote wins. Locks
					the RFQ.
				</li>
			</ul>

			<h2 id="numbering">Numbering</h2>
			<p>
				RFQ numbers are <code>RQ#####</code>. Old <code>RFQ#####</code> numbers from the
				pre-rename era still display as <code>RQ#####</code> (the renumber migration handled
				existing records).
			</p>
		</>
	);
}
