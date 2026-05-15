export default function BudgetsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Budgets</h1>
			<p>
				A budget is a versioned snapshot of the QAP&apos;s pricing at a design milestone. PMs
				create a new budget each time the design or pricing changes meaningfully — at GMP set,
				at IFC, at permit, etc. Each budget freezes its lines in time, so you can compare
				against earlier versions and against the project&apos;s target.
			</p>

			<h2 id="when">When to create one</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>After a meaningful round of QAP edits</li>
				<li>At a major design milestone (SD/DD/CD/CA)</li>
				<li>When RFQs come back and pricing changes</li>
				<li>Before sending to the client for budget approval</li>
				<li>To explore a what-if scenario (clone an existing budget, tweak qty/unit DN, see the new total)</li>
			</ul>

			<h2 id="create">Creating a budget</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From a project, click <strong>Budgets</strong>, then <strong>+ New budget</strong>.
					A blank budget (BU#####) opens with the project&apos;s margin / freight / warehousing
					/ sales-tax % defaults pre-filled.
				</li>
				<li>
					Set the <strong>Description</strong> — a label that appears on the list page. ILC&apos;s
					convention is something like <em>FINAL UPDATE</em>, <em>SUBMITTAL &amp; RFI UPDATES</em>,
					<em>GMP SET</em>, <em>IFC SET</em>, <em>PERMIT SET</em>.
				</li>
				<li>
					Scroll to <strong>Add lines from QAP</strong>. Search the available QAP lines, tick
					the ones you want, click <strong>Add selected to budget</strong>. Each line snapshots
					with type, catalog #, manufacturer, description, qty, and current DN.
				</li>
				<li>
					In the lines table, the per-budget <strong>Budget qty</strong> and{' '}
					<strong>Budget unit DN</strong> are editable. This is the &quot;what-if&quot;
					capability — tweak numbers without touching the QAP. Yellow highlight on dirty rows;
					bulk Save commits.
				</li>
				<li>
					When satisfied, mark <strong>Sent</strong>. Lines lock. When the client signs off,
					mark <strong>Confirmed</strong>.
				</li>
				<li>
					Download the PDF for emailing or filing.
				</li>
			</ol>

			<h2 id="totals">Totals &amp; metrics</h2>
			<p>The budget workbench shows live totals computed against your current edits:</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><strong>DN total</strong> — sum of (qty × unit DN). What ILC pays.</li>
				<li><strong>CN total</strong> — DN total × (1 + margin/100). What ILC charges.</li>
				<li><strong>Profit</strong> — CN total − DN total.</li>
				<li><strong>$/SF</strong> — CN total ÷ project total SF (if total SF is set on the project).</li>
				<li>
					<strong>vs target</strong> — CN total − project target budget. Red if positive (over
					budget), green if negative (under budget).
				</li>
			</ul>
			<p>
				Set <strong>Target product budget $</strong> and <strong>Target $/SF</strong> on the
				project edit form to enable the &quot;vs target&quot; comparison.
			</p>

			<h2 id="refresh">Refresh from QAP</h2>
			<p>
				If the QAP has been updated since you created the budget — prices changed, qty changed,
				or descriptions edited — and you want the budget to reflect the new state:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Click <strong>Refresh from QAP</strong>. Ebisu pulls current QAP values for every
					budget line and overwrites the snapshot + the editable qty/unit DN.
				</li>
				<li>
					This is destructive — your per-line edits are lost. Use{' '}
					<strong>Clone as new draft</strong> first if you want to keep both versions.
				</li>
			</ol>

			<h2 id="clone">Cloning</h2>
			<p>
				Click <strong>Clone as new draft</strong> to create a new BU##### with the same lines
				and header settings. Useful for:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>What-if scenarios — clone, tweak, compare on the list page</li>
				<li>Versioned milestones — clone a confirmed budget, refresh from QAP, send as the new version</li>
			</ul>

			<h2 id="snapshots-vs-live">Snapshots vs. live values</h2>
			<p>
				Each budget line has both a <em>snapshot</em> column (what the QAP said at line creation)
				and a <em>live</em> column (the editable qty/unit DN PMs use for what-if). The snapshot
				doesn&apos;t change unless you click Refresh from QAP. The live values are what feed
				the totals, the PDF, and the metrics. This separation lets PMs see &quot;here&apos;s
				what the QAP says today, and here&apos;s what I&apos;m budgeting against.&quot;
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>draft</code> → <code>sent</code> → <code>confirmed</code>. Plus{' '}
				<code>archived</code>. Once a budget is past draft, its lines are locked — clone it to
				get back an editable version.
			</p>

			<h2 id="numbering">Numbering</h2>
			<p>
				Budget numbers are <code>BU#####</code> — global sequence across the system.
			</p>
		</>
	);
}
