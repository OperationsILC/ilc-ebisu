export default function QapHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>QAP — Quantity And Pricing</h1>
			<p>
				The QAP is the master schedule of every fixture and control on a project. Each row is
				one line item: manufacturer + catalog # + finish + CCT/wattage/voltage + quantity +
				dealer-net price + margin. The QAP is the source of truth — everything downstream (RFQs,
				SOs, POs, invoices) snapshots from it at the moment of creation.
			</p>

			<h2 id="open">Opening the grid</h2>
			<p>
				From a project, click <strong>Open QAP</strong>. You land on a spreadsheet view of every
				row on the project. The grid is virtualized — even on a 2000-row project, scrolling stays
				smooth.
			</p>

			<h2 id="columns">Columns</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>QAP ID</strong></dt>
				<dd>
					Auto-generated as <code>PROJECT - TYPE - CATALOG #</code>. Used as a stable
					reference across docs.
				</dd>
				<dt><strong>Type</strong></dt>
				<dd>
					Project-specific short code from the designer&apos;s drawings (e.g.{' '}
					<code>A1</code>, <code>W2-ALT</code>, <code>CON-6</code>). Types are global to ILC
					and reusable across projects.
				</dd>
				<dt><strong>Manufacturer</strong></dt>
				<dd>
					The actual maker of the fixture. Comes from <a href="/companies">companies</a> with
					role=manufacturer.
				</dd>
				<dt><strong>Catalog #</strong></dt>
				<dd>
					The manufacturer&apos;s product number. Scoped to manufacturer — two manufacturers
					can have the same catalog # for different products without conflict.
				</dd>
				<dt><strong>QTY</strong> + <strong>QTY type</strong></dt>
				<dd>
					Quantity needed. QTY type is the unit (EA, LF, KIT, SET, ROLL, BOX, PCS).
				</dd>
				<dt><strong>Current DN</strong></dt>
				<dd>
					Latest dealer-net price (what the manufacturer or rep firm charges ILC). Edited
					directly here, or pushed from a quoted RFQ line.
				</dd>
				<dt><strong>Margin %</strong></dt>
				<dd>
					Per-line margin override. Null = inherit project default.
				</dd>
				<dt><strong>PR Original *</strong></dt>
				<dd>
					Snapshot fields capturing the very first import: <code>pr_original_manufacturer</code>,{' '}
					<code>pr_original_spec</code>, <code>pr_original_spec_detail</code>. These are{' '}
					<em>write-once</em>; they never overwrite once set. Useful for tracking what changed
					since design started.
				</dd>
				<dt><strong>Finish, CCT, Wattage, Voltage, Dim, Mounting, etc.</strong></dt>
				<dd>Spec fields. Most are free text; CCT/Watt/Volt accept numbers.</dd>
			</dl>

			<h2 id="import">Importing from a CSV</h2>
			<p>
				The fastest way to populate a QAP. Click <strong>Import CSV</strong> on the project
				page.
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Upload the CSV. Format matches Mason&apos;s existing Google Sheets template — same
					columns, same order.
				</li>
				<li>
					Ebisu runs a <strong>pre-flight check</strong>: every unique MANUFACTURER value is
					looked up against the companies table. Anything unrecognized triggers a modal asking
					you to <strong>Ignore</strong> (skip those rows) or <strong>Revise</strong>
					(cancel the import; you go fix the CSV and re-upload).
				</li>
				<li>
					Confirm. Ebisu imports row by row:
					<ul>
						<li>Rows where CATALOG # contains <code>&quot; + &quot;</code> are <strong>kit rows</strong> — they expand into multiple QAP rows on import.</li>
						<li>Slug rows (placeholder rows like <code>field_3</code>) are skipped.</li>
						<li>Types that don&apos;t exist auto-create as global ILC types.</li>
						<li>Catalog numbers that don&apos;t exist auto-create scoped to the manufacturer.</li>
						<li>Existing rows are upserted by <code>(project, type, product)</code>. If the row hashes are identical, it&apos;s a no-op (re-import is idempotent — safe to re-upload a tweaked CSV).</li>
						<li><strong>PR_ORIGINAL_*</strong> fields are write-once; never overwritten.</li>
					</ul>
				</li>
				<li>
					Review the import summary: how many rows imported, skipped, failed. Status is
					recorded on the <code>import_sessions</code> table.
				</li>
			</ol>

			<h2 id="edit">Editing the grid</h2>
			<p>
				Click a cell, type, hit Tab or Enter to move to the next cell. Edits highlight yellow
				until saved. Click <strong>Save</strong> in the toolbar to commit all dirty cells in one
				batch.
			</p>

			<h3 id="concurrency">Two PMs editing the same row</h3>
			<p>
				Optimistic concurrency via a <code>row_version</code> column. If someone else saved
				between your load and your save, you&apos;ll get a per-row <em>stale_row_version</em>{' '}
				error with the server&apos;s current data shown. Refresh and re-apply your changes.
			</p>

			<h3 id="audit">Audit trail</h3>
			<p>
				Every change is logged in <code>audit_cells</code> with the old value, new value, who
				changed it, and when. There&apos;s no audit-viewer UI yet, but the data&apos;s there for
				future reporting.
			</p>

			<h2 id="downstream">QAP → SO → PO</h2>
			<p>
				When a project advances, you build an SO from the QAP via the SO workbench&apos;s{' '}
				<a href="/help/sales-orders"><strong>Add lines from QAP</strong></a> panel. The QAP rows
				snapshot onto the SO — qty, DN, manufacturer, catalog #, etc. After that, the SO line is
				its own thing; later QAP edits don&apos;t affect the SO. This is on purpose — once you
				commit to sell, the spec freezes.
			</p>

			<h2 id="caveats">Caveats</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Don&apos;t delete a QAP row that&apos;s been pulled into an SO — the foreign key is
					set to ON DELETE SET NULL, so the SO line keeps its snapshot but loses the audit
					link.
				</li>
				<li>
					Catalog numbers are scoped to manufacturer. Re-importing a CSV where you renamed a
					row from one manufacturer to another creates a new row rather than updating the
					existing one.
				</li>
				<li>
					Kit expansion happens on import only. Editing a CATALOG # to contain{' '}
					<code>&quot; + &quot;</code> in the grid won&apos;t auto-split.
				</li>
			</ul>
		</>
	);
}
