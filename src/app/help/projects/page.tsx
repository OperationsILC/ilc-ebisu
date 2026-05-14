export default function ProjectsHelp() {
	return (
		<>
			<p>
				<a href="/help">← Help</a>
			</p>
			<h1>Projects</h1>
			<p className="muted">
				This page is a stub. The full project workflow guide is coming. If you have a specific
				question that can&apos;t wait, ask Sean or look at the field labels — they&apos;re
				generally self-explanatory.
			</p>

			<h2>Quick notes</h2>
			<ul style={{ lineHeight: 1.7 }}>
				<li>Every project has a unique name; rename freely, but be aware it appears on PDFs.</li>
				<li>
					<strong>Margin %</strong>, <strong>Freight %</strong>, <strong>Warehousing %</strong>,
					and <strong>Sales tax %</strong> set the project&apos;s defaults. These cascade onto
					new SOs and invoices created under the project; each document can override them.
				</li>
				<li>
					Delivery address (where ILC ships TO — usually a warehouse or GC) and job site
					address (the physical building) are distinct. Job site drives sales tax jurisdiction.
				</li>
				<li>
					The <strong>Total SF</strong>, <strong>Interior SF</strong>, and supplemental SF
					breakdowns (unit/room, garage, BOH, open office, private office, corridor, amenity,
					unfinished office) feed budget $/SF metrics.
				</li>
				<li>
					Phase (SD/DD/CD/CA) is informational — Ebisu doesn&apos;t gate behavior on it yet.
				</li>
			</ul>
		</>
	);
}
