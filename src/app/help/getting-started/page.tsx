export default function GettingStartedHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Getting started</h1>
			<p>
				Ebisu is a web app you access through Google. There&apos;s nothing to install. It works
				on desktop and is usable on a tablet for read-only review, but most workflows assume a
				keyboard.
			</p>

			<h2>Signing in</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Go to the production URL (your bookmark, or whatever Sean sent you).
				</li>
				<li>Click <strong>Sign in with Google</strong>.</li>
				<li>
					Pick your <code>@ilcstudios.com</code> account. Personal Google accounts and other
					domains are rejected — that&apos;s by design.
				</li>
			</ol>
			<p>
				Once signed in your email shows in the top-right of every page, along with your role
				(admin, project_manager, designer, warehousing, or user). If your role looks wrong, tell
				Sean — it&apos;s set in the database, not in your Google account.
			</p>

			<h2>The main navigation</h2>
			<p>Across the top of every page you have:</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Home</strong> — currently the sign-in landing page; lands you back on{' '}
					<a href="/projects">Projects</a> if you&apos;re already signed in.
				</li>
				<li>
					<strong>Projects</strong> — every project ILC is working on, sorted by most recently
					updated.
				</li>
				<li>
					<strong>Companies</strong> — clients, GCs, designers, manufacturers, rep firms. The
					address book.
				</li>
				<li>
					<strong>Bills inbox</strong> — every payable bill in the system. Mostly used to find
					bills that arrived from DocParser but weren&apos;t auto-matched to a PO.
				</li>
				<li>
					<strong>Help</strong> — you&apos;re here.
				</li>
			</ul>

			<h2>The shape of a project</h2>
			<p>
				Every project page (e.g. <code>/projects/[id]</code>) has the same buttons across the
				top. Each one drops you into a focused workbench for that step of the workflow:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Open QAP</strong> — the master fixture & control schedule. The source of
					truth for what&apos;s on the project.
				</li>
				<li>
					<strong>Import CSV</strong> — bulk-load QAP rows from a spreadsheet.
				</li>
				<li>
					<strong>RFQs</strong> — requests for quotes to rep firms.
				</li>
				<li>
					<strong>Sales Orders</strong> — what ILC sells to the client.
				</li>
				<li>
					<strong>Purchase Orders</strong> — what ILC orders from manufacturers (via reps).
				</li>
				<li>
					<strong>Shipments</strong> — deliveries against POs.
				</li>
				<li>
					<strong>Invoices</strong> — what ILC bills the client.
				</li>
				<li>
					<strong>Bills</strong> — what vendors bill ILC.
				</li>
			</ul>

			<h2>Editing conventions</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Most pages use <strong>edit-then-Save</strong>. You can change many cells, then hit a
					single Save button. Edited cells highlight yellow until you save.
				</li>
				<li>
					If two people edit the same row, the second person to save gets a{' '}
					<em>stale row version</em> error, with the server&apos;s current data shown. Refresh
					and re-apply.
				</li>
				<li>
					Documents (RFQs, SOs, POs, invoices, bills) move through a status lifecycle. Some
					actions are only available in <code>draft</code> status — once you mark something{' '}
					<code>sent</code>, lines lock to prevent retroactive edits.
				</li>
			</ul>

			<h2>Where things go</h2>
			<p>
				If something feels missing or broken, it might be:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Not built yet. Ebisu is still in active build-out. Tell Sean — most things can be
					added quickly.
				</li>
				<li>
					Locked because the document is no longer in <code>draft</code>. Look for a status
					badge near the top of the page.
				</li>
				<li>
					In a different workflow. E.g. you can&apos;t edit prices on a PO that&apos;s been
					sent — you&apos;d issue a Change Order (coming soon).
				</li>
			</ul>

			<h2>Next steps</h2>
			<p>Pick the workflow you&apos;re about to do:</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><a href="/help/projects">Create or edit a project</a></li>
				<li><a href="/help/qap">Work with the QAP grid</a></li>
				<li><a href="/help/rfqs">Send an RFQ</a></li>
				<li><a href="/help/sales-orders">Create a Sales Order</a></li>
				<li><a href="/help/invoices">Create an invoice</a></li>
				<li><a href="/help/bills">Review a payable bill</a></li>
			</ul>
		</>
	);
}
