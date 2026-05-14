export default function QapHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>QAP — Quantity And Pricing</h1>
			<p className="muted">
				Full QAP guide coming. Below are the headline mechanics designers and PMs need today.
			</p>

			<h2>What the QAP is</h2>
			<p>
				The QAP is the master schedule of every fixture and control on a project. Each row is
				one line item: a manufacturer + catalog number + finish + CCT/wattage/voltage spec +
				quantity + dealer-net price + margin. Everything downstream (RFQs, SOs, POs) snapshots
				from the QAP at the moment of creation.
			</p>

			<h2>Importing from a CSV</h2>
			<p>
				The fastest way to populate a QAP is the CSV importer at <strong>Import CSV</strong> on
				the project page. The expected column layout matches Mason&apos;s existing Google
				Sheets template (the same one designers have been using).
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Rows where CATALOG # contains <code>&quot; + &quot;</code> are <em>kit</em> rows.
					They expand into multiple QAP rows on import.
				</li>
				<li>
					New manufacturers in the CSV trigger a pre-flight modal that lets you tag them
					&quot;Ignore&quot; (skip that row) or &quot;Revise&quot; (cancel import and fix the
					CSV).
				</li>
				<li>
					Types and catalog numbers auto-create if they don&apos;t exist. Types are global to
					ILC; catalog numbers are scoped to a manufacturer.
				</li>
				<li>
					Re-import is idempotent — rows that match a previous import (by content hash) are
					skipped. So you can re-upload a tweaked CSV without creating duplicates.
				</li>
				<li>
					The PR_ORIGINAL_* fields capture the very first import for each row and are{' '}
					<em>write-once</em>. They never get overwritten by a later import. Useful for
					tracking what changed since design started.
				</li>
			</ul>

			<h2>Editing the grid</h2>
			<p>
				The QAP grid (powered by AG Grid) supports inline cell editing. Click a cell, type, hit
				Enter or Tab to move on. Edited cells highlight yellow. Click <strong>Save</strong> to
				commit all dirty cells in one batch.
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Optimistic concurrency: if someone else saved between your load and your save,
					you&apos;ll get a per-row error telling you the server&apos;s current value. Refresh
					and re-apply.
				</li>
				<li>
					Cell-level audit: every change is logged in <code>audit_cells</code> with old value,
					new value, and who made the change.
				</li>
			</ul>

			<h2>From QAP to SO</h2>
			<p>
				When the design is settled, open a Sales Order and use{' '}
				<strong>Add lines from QAP</strong>. The QAP rows snapshot onto the SO — qty, dealer
				net, manufacturer, catalog #, etc. After that, the SO line is its own thing; later
				edits to the QAP don&apos;t affect the SO. (This is on purpose. Once you commit to
				sell, the spec freezes.)
			</p>
		</>
	);
}
