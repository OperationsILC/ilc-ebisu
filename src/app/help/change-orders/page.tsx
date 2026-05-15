export default function ChangeOrdersHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Change Orders</h1>
			<p>
				A Change Order (CO) captures changes to a Purchase Order that&apos;s already been sent.
				Once a PO is in the wild, you can&apos;t just edit lines on it — the rep firm has a
				copy that says X, and quietly mutating Ebisu would diverge from their understanding.
				Instead, you record the diff as a CO, the rep firm acknowledges, and applying the CO
				bumps the PO&apos;s version number to the next integer.
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>draft</code> → <code>sent</code> → <code>acknowledged</code> → <code>applied</code>.
				Plus <code>rejected</code> and <code>cancelled</code>.
			</p>
			<p>
				<strong>Only one open CO per PO at a time.</strong> If a CO is in draft/sent/acknowledged
				state, you can&apos;t start another against the same PO. Apply or cancel the open one
				first.
			</p>

			<h2 id="when">When to use a CO vs. edit the PO directly</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>PO is still in draft (not yet sent)</strong></dt>
				<dd>
					Just edit the PO directly on the PO workbench. No need for a CO — the rep
					hasn&apos;t seen anything yet.
				</dd>
				<dt><strong>PO has been sent</strong></dt>
				<dd>
					Use a CO. This includes the cases <code>sent</code>, <code>acknowledged</code>,{' '}
					<code>shipped</code>, and <code>received</code> — any time the rep firm has a version
					of the PO on file.
				</dd>
			</dl>

			<h2 id="create">Creating a CO</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From a sent PO, click the <strong>Change Orders</strong> link near the top, then{' '}
					<strong>+ New Change Order</strong>. The CO opens in draft.
				</li>
				<li>
					Fill in <strong>Description</strong> — a short explanation for why this CO exists
					(&quot;Manufacturer raised price on the EM-FE-25 line by 8% on 2026-04-15&quot;).
					Optionally pick a <strong>Reason category</strong> for reporting.
				</li>
				<li>
					Add the actual changes — see below.
				</li>
				<li>
					When the changes look complete, click <strong>Mark sent</strong>. The CO PDF is now
					ready to email to the rep.
				</li>
				<li>
					When the rep acknowledges, click <strong>Mark acknowledged</strong>.
				</li>
				<li>
					Click <strong>Apply to PO →</strong>. This mutates the PO&apos;s order_lines (adds /
					removes / modifies as the CO dictates) and bumps the PO&apos;s <code>version_no</code>.
					Stamped <code>applied_at</code> and <code>applied_by</code>. Irreversible — you
					can&apos;t un-apply a CO, but you can issue another CO to reverse the changes if
					needed.
				</li>
			</ol>

			<h2 id="changes">Three kinds of changes</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>Modify an existing PO line</strong></dt>
				<dd>
					Find the line in the <strong>Modify or remove an existing PO line</strong> table.
					Click <strong>Modify</strong>. Enter the new qty, unit DN, catalog #, or
					description (blank = no change for that field). Save.
				</dd>
				<dt><strong>Remove a PO line</strong></dt>
				<dd>
					Same table; click <strong>Remove</strong>. Ebisu asks for a reason. The line stays
					on the PO until the CO is applied; then it&apos;s deleted.
				</dd>
				<dt><strong>Add a brand-new line</strong></dt>
				<dd>
					Use the <strong>Add a brand-new line to the PO</strong> form. Type, catalog #,
					manufacturer, description, qty, UoM, unit DN. On apply, this becomes a new
					<code>order_lines</code> row attached to the same PO and its parent SO.
				</dd>
			</dl>

			<h2 id="net-change">Net change calculation</h2>
			<p>
				Each CO line contributes a <strong>Δ $</strong> (delta) to the CO&apos;s{' '}
				<strong>Net change to PO total</strong>. The math:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><strong>Modify:</strong> (qty_after × unit_dn_after) − (qty_before × unit_dn_before)</li>
				<li><strong>Add:</strong> + (qty × unit_dn)</li>
				<li><strong>Remove:</strong> − (qty × unit_dn)</li>
			</ul>
			<p>
				Positive net change means ILC pays more; negative means ILC pays less. Color-coded
				red/green on the workbench.
			</p>

			<h2 id="pdf">CO PDF</h2>
			<p>
				Download the CO PDF to email to the rep firm. Shows:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>ILC wordmark + CO number + date</li>
				<li>To/From addresses</li>
				<li>CO #, PO #, project, version delta (v3 → v4), status, sent/applied dates</li>
				<li>Custom email message if you set one</li>
				<li>Description as a callout</li>
				<li>
					Lines table with operation (ADD/REMOVE/MODIFY), before → after for catalog #,
					description, qty, unit DN, and the Δ $ contribution
				</li>
				<li>Big highlighted net-change-to-PO-total at the bottom</li>
			</ul>

			<h2 id="versioning">PO versioning</h2>
			<p>
				A new PO starts at <code>v1</code>. The first CO applied bumps it to <code>v2</code>,
				the next to <code>v3</code>, and so on. The CO record stores both the version it was
				written against and the version it produces, so you can reconstruct the timeline:
				&quot;CO00042 took the PO from v3 to v4 with a net change of +$1,240.&quot;
			</p>

			<h2 id="rejected">If the rep rejects the changes</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>Click <strong>Reject</strong> on the CO workbench, enter the reason.</li>
				<li>
					CO status flips to <code>rejected</code>. PO is unchanged — no apply happened.
				</li>
				<li>
					Now you can start a new CO with revised changes.
				</li>
			</ol>

			<h2 id="cancelled">Cancelling a CO</h2>
			<p>
				If you started a CO and decide not to pursue it (different from rejected, which means
				the rep said no), use <strong>Cancel CO</strong>. The CO is marked cancelled and the PO
				stays at its current version.
			</p>

			<h2 id="qbo">QBO push</h2>
			<p>
				Not built yet. The schema slot (<code>qbo_id</code>, <code>qbo_status</code>) exists for
				when the QBO integration ships. At that point, applied COs that change pricing will
				push as PO updates to keep QBO&apos;s purchase records in sync.
			</p>

			<h2 id="numbering">Numbering</h2>
			<p>
				CO numbers are <code>CO#####</code> — global sequence.
			</p>
		</>
	);
}
