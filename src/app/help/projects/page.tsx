export default function ProjectsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Projects</h1>
			<p>
				A project is the unit of work in Ebisu. Every fixture, RFQ, sales order, purchase order,
				shipment, invoice, and bill belongs to a project. Most PMs spend their day inside one
				project at a time.
			</p>

			<h2 id="create">Creating a project</h2>
			<ol style={{ lineHeight: 1.7 }}>
				<li>
					From the top nav, click <strong>Projects</strong>, then <strong>+ New project</strong>.
				</li>
				<li>
					Give it a unique name. Names appear on PDFs and emails, so use the format your team
					uses externally (e.g. <code>AVILLA HOLLOWAY</code>).
				</li>
				<li>
					Set <strong>Status</strong> to <code>active</code>, pick a <strong>Phase</strong> if
					you know it (SD/DD/CD/CA), and tag a <strong>Project type</strong> (Hospitality,
					Multifamily, etc.).
				</li>
				<li>
					Pick the <strong>ILC team</strong> — at minimum a PM. Design lead, second designer,
					sales person, CA manager can fill in over time.
				</li>
				<li>
					Pick the <strong>Client</strong>, <strong>GC</strong>, and <strong>Designer</strong>{' '}
					companies. If one doesn&apos;t exist yet, click through to{' '}
					<a href="/companies/new" target="_blank">Companies</a> to add it, then come back.
				</li>
				<li>
					Set financial defaults — <strong>Margin %</strong>, <strong>Freight %</strong>,{' '}
					<strong>Warehousing %</strong>, <strong>Sales tax %</strong> (and the human-readable{' '}
					<strong>Sales tax label</strong>, e.g. &quot;2.9% — CO STATE&quot;). These cascade
					onto every SO and invoice created under the project; each document can override.
				</li>
				<li>
					Fill in delivery address and job site address. They&apos;re separate on purpose —
					delivery is where ILC ships TO (usually the GC&apos;s warehouse), and job site is
					where the building is. Job site drives sales tax jurisdiction.
				</li>
				<li>
					Save. You land on the project detail page.
				</li>
			</ol>

			<h2 id="edit">Editing</h2>
			<p>
				Click <strong>Edit project ↗</strong> next to the project name on its detail page.
				Same form as creation; every field is editable. You can also rename — though be aware
				the name appears on existing PDFs (which are regenerated on download, so they&apos;ll
				pick up the new name).
			</p>

			<h2 id="dates">Key dates</h2>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>Design start date</strong></dt>
				<dd>When ILC was engaged. Informational.</dd>
				<dt><strong>IFC sub date</strong></dt>
				<dd>
					When the drawings went Issued For Construction. Often the trigger for ordering
					long-lead items.
				</dd>
				<dt><strong>Expected order date</strong></dt>
				<dd>
					When ILC anticipates the first PO will go out. Helps reps prepare quotes and
					anticipate orders.
				</dd>
				<dt><strong>Rough-in start date</strong></dt>
				<dd>When electrical rough-in begins on site.</dd>
				<dt><strong>Construction start date</strong></dt>
				<dd>When general construction begins.</dd>
			</dl>

			<h2 id="financial">Financial defaults</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Margin %</strong> — markup from dealer-net (cost) to client-net (sell). 23% is
					a common default.
				</li>
				<li>
					<strong>Freight %</strong> — anticipated freight cost as a percent of subtotal.
					Becomes a line on the SO totals.
				</li>
				<li>
					<strong>Warehousing %</strong> — anticipated warehousing cost as a percent of subtotal.
				</li>
				<li>
					<strong>Sales tax %</strong> — invoice sales tax rate. Driven by job-site
					jurisdiction. Override on individual invoices if the jobsite tax differs from the
					project default.
				</li>
				<li>
					<strong>Sales tax label</strong> — human-readable label like
					&quot;8% — STOCKBRIDGE, GA&quot;. Appears on invoice PDFs.
				</li>
				<li>
					<strong>Projected design fee total</strong> — top-line forecast of design-fee
					revenue for this project. Compares against the running total of design-fee invoices.
				</li>
			</ul>

			<h2 id="emails">Email overrides</h2>
			<p>
				By default, RFQs and POs use the company&apos;s default emails (set on the company
				record). For projects where a different stakeholder gets emails — e.g., the GC&apos;s
				PM for shipment updates instead of the company&apos;s general inbox — set the
				project-level overrides:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li><strong>Emails for budgets</strong> — who gets budget PDFs</li>
				<li><strong>Emails for quotes/SOs</strong> — who gets sales order documents</li>
				<li><strong>Emails for shipment updates</strong> — who gets delivery notifications</li>
			</ul>
			<p>
				Comma-separated. If blank, falls back to the relevant company&apos;s default emails.
			</p>

			<h2 id="addresses">Two addresses</h2>
			<p>
				Distinguishing delivery from job site matters:
			</p>
			<dl style={{ lineHeight: 1.7 }}>
				<dt><strong>Delivery address</strong></dt>
				<dd>
					Where the truck actually drops the boxes. Usually the electrical contractor&apos;s
					warehouse (e.g. &quot;LAKEWOOD ELECTRIC: 3533 Timber Mill Pkwy, Castle Rock CO&quot;).
					Appears as the default ship-to on every PO; override per-PO when shipping direct.
				</dd>
				<dt><strong>Job site address</strong></dt>
				<dd>
					The physical building. Drives sales tax jurisdiction. Often somewhere completely
					different from the delivery address.
				</dd>
			</dl>

			<h2 id="sf">Square footage</h2>
			<p>
				Top-line (total, interior, exterior) plus an optional breakdown by space type for
				budget $/SF analysis: unit/room, garage, back-of-house, open office, private office,
				corridor, amenity, unfinished office. Only fill in what&apos;s known — the metrics
				gracefully ignore blanks.
			</p>

			<h2 id="notes">Notes vs. project stats</h2>
			<p>
				Three free-form text fields for different concerns:
			</p>
			<ul style={{ lineHeight: 1.7 }}>
				<li>
					<strong>Description</strong> — short one-liner, used as a subtitle on some documents.
				</li>
				<li>
					<strong>Project notes</strong> — design intent, scoping decisions, anything the team
					needs to remember.
				</li>
				<li>
					<strong>Project stats</strong> — tax/permit/jurisdiction notes that don&apos;t fit
					anywhere else (e.g. &quot;PER JAMIE: Routt County and Steamboat collect a USE tax at
					permit pickup. We haven&apos;t submitted for permit and will not do so until
					December...&quot;).
				</li>
			</ul>
			<p>
				None of these appear on external documents.
			</p>
		</>
	);
}
