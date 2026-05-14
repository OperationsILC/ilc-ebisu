export default function RfqsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>RFQs — requesting quotes</h1>
			<p className="muted">Stub. Full RFQ guide coming.</p>

			<h2>Quick mechanics</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					An RFQ goes to one rep firm at a time. If a manufacturer is repped by two firms in
					your territory and you want pricing from both, create two RFQs.
				</li>
				<li>
					From the project, click <strong>RFQs</strong>, then <strong>+ New RFQ</strong>. Pick
					the rep firm, then pick QAP lines to include. The lines snapshot — later QAP changes
					don&apos;t affect a sent RFQ.
				</li>
				<li>
					When the rep replies with quoted prices, enter the <strong>Quoted DN</strong> per
					line on the RFQ detail page. There&apos;s a <strong>Push to QAP</strong> action
					that promotes the quoted price to <code>current_dn</code> on the corresponding QAP
					row.
				</li>
				<li>
					Send the RFQ via the <strong>Send</strong> button — it emails the rep firm using
					their quote_emails (set on the company record). <code>DEV_EMAIL_REDIRECT</code> env
					var diverts mail to a safe address in non-production environments.
				</li>
				<li>RFQ numbers are <code>RQ#####</code>.</li>
			</ul>
		</>
	);
}
