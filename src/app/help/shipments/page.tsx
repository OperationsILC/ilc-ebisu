export default function ShipmentsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Shipments &amp; Deliveries</h1>
			<p>
				A shipment is one physical delivery from a rep firm against a PO. A PO can have many
				shipments because manufacturers commonly split deliveries (50 now, 50 in six weeks).
				Each shipment is composed of <strong>shipment lines</strong>, one per PO line on this
				delivery, with a <code>qty_shipped</code> that can be less than the line&apos;s qty —
				partial deliveries are first-class.
			</p>

			<h2 id="lifecycle">Lifecycle</h2>
			<p>
				<code>expected</code> → <code>in_transit</code> → <code>received</code>. Plus{' '}
				<code>partial</code> (arrived but short — investigation pending) and{' '}
				<code>cancelled</code>.
			</p>

			<h2 id="create">Logging an expected shipment</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From a PO, click the <strong>Shipments</strong> link near the top.
				</li>
				<li>
					Click <strong>+ New shipment</strong>. A draft shipment in <code>expected</code>{' '}
					status opens; it has no lines yet.
				</li>
				<li>
					In the lines table, every PO line is listed with reference columns:
					<ul>
						<li><strong>Ordered</strong> — total qty on the PO line</li>
						<li><strong>Other shipments</strong> — qty already on other (non-cancelled) shipments</li>
						<li><strong>Other received</strong> — qty already received elsewhere</li>
						<li><strong>Still open</strong> — what&apos;s left to ship</li>
						<li><strong>On this shipment</strong> — the editable field</li>
					</ul>
				</li>
				<li>
					Enter the qty of each line that&apos;s on this shipment. Leave 0 or blank to exclude
					a line. Add per-line notes (e.g. &quot;missing 2 lenses&quot;) if useful.
				</li>
				<li>
					Click <strong>Save lines</strong>. Lines with <code>qty_shipped &gt; 0</code> get
					recorded; lines you cleared get removed from this shipment.
				</li>
			</ol>

			<h3 id="over-commit">Over-commit warnings</h3>
			<p>
				If the qty you&apos;re entering plus the qty on other shipments exceeds the PO
				line&apos;s ordered qty, the input border turns red. Allowed but flagged — manufacturers
				sometimes over-ship (sending extras as goodwill, or because they made too many). Save
				anyway; the warning persists so you remember to reconcile later.
			</p>

			<h2 id="receive">Marking received</h2>
			<p>
				When the boxes physically arrive:
			</p>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					Open the shipment.
				</li>
				<li>
					Click <strong>Mark received</strong>. One-click action that:
					<ul>
						<li>Flips status to <code>received</code></li>
						<li>Auto-stamps <code>received_date</code> if not already set</li>
						<li>Auto-stamps <code>received_by_user_id</code> with you</li>
						<li>Refreshes the parent PO&apos;s RCVD rollup column</li>
					</ul>
				</li>
				<li>
					Optionally edit the header to add <strong>received-at location</strong> (warehouse,
					jobsite, &quot;Bay 3&quot;, etc.) for future-you to find the boxes.
				</li>
			</ol>
			<p>
				You can also enter dates manually in the header form (Expected, Shipped, Received) and
				let the status reflect reality.
			</p>

			<h3 id="partial">When a shipment is short</h3>
			<p>
				If the truck arrived but is missing items, you have two options:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					Mark the shipment <code>partial</code> (status), adjust the qty_shipped on the
					affected lines down to what actually arrived, and create a new <em>expected</em>{' '}
					shipment for the rest.
				</li>
				<li>
					Mark the shipment <code>received</code> with the missing items&apos; qty set to what
					actually came, and let those line&apos;s open qty roll forward to the next
					shipment.
				</li>
			</ul>
			<p>Either way, the math holds — open qty on the PO line is reduced only by what&apos;s been received.</p>

			<h2 id="rollups">PO and project rollups</h2>
			<p>
				The PO detail page shows a Shipments link near the top with a status count (e.g.
				&quot;3 shipments (2 received) →&quot;). The per-line <strong>RCVD</strong> column on
				the PO line table shows received + committed-to-upcoming, formatted{' '}
				<code>received+committed</code> (e.g. <code>12+8</code> = 12 received, 8 on
				expected/in-transit).
			</p>
			<p>
				The project-level <strong>Shipments (N)</strong> button on the project detail page
				lists every shipment across every PO in the project, with status-bucketed counts at the
				top.
			</p>

			<h2 id="invoices">Shipments → invoices</h2>
			<p>
				A shipment line in <code>received</code> status is eligible to bill on a product
				invoice. When you create a new invoice from the SO, the{' '}
				<strong>Delivered &amp; uninvoiced</strong> panel surfaces these lines — see{' '}
				<a href="/help/invoices#progress-billing">invoices: progress billing</a>.
			</p>

			<h2 id="permissions">Who marks received?</h2>
			<p>
				Today, anyone with project access can mark a shipment received. TrackVia had a workflow
				constraint that only specific users (e.g. Olivia in warehousing) could mark deliveries
				received. We haven&apos;t built that role-based gate yet; tell Sean if you need it.
			</p>

			<h2 id="numbering">Numbering</h2>
			<p>
				Shipment numbers are <code>SH#####</code> — global sequence. Old <code>SHP#####</code>{' '}
				numbers from the pre-rename era display as <code>SH#####</code> (the renumber migration
				handled existing records).
			</p>
		</>
	);
}
