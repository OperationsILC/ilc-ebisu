import { db } from '@/lib/db';
import { projects, companies, bills, qboConnections } from '@/lib/db/schema';
import { desc, count, eq, and, isNull, sql } from 'drizzle-orm';
import TabHelp from './components/TabHelp';

export default async function HomePage() {
	// Top 8 most-recently-touched projects so the team can jump back into
	// whatever they were last working on.
	const recentProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			phase: projects.phase,
			updatedAt: projects.updatedAt
		})
		.from(projects)
		.orderBy(desc(projects.updatedAt))
		.limit(8);

	const [projectsCount] = await db.select({ n: count() }).from(projects);
	const [companiesCount] = await db.select({ n: count() }).from(companies);
	const [billsPendingCount] = await db
		.select({ n: count() })
		.from(bills)
		.where(eq(bills.status, 'pending_review'));

	// Active QBO connection (for the small QBO tile).
	const [activeQbo] = await db
		.select({ env: qboConnections.environment, realmId: qboConnections.realmId })
		.from(qboConnections)
		.where(isNull(qboConnections.disconnectedAt))
		.limit(1);

	// One cheap cross-project sanity check: how many projects have no client
	// company set? Often the first thing that bites a new PM.
	const [{ missingClient }] = await db
		.select({
			missingClient: sql<number>`count(*) filter (where ${projects.clientCompanyId} is null)::int`
		})
		.from(projects);

	return (
		<>
			<h1 style={{ marginBottom: 4 }}>Ebisu</h1>
			<p className="muted" style={{ marginTop: 0 }}>ILC Studios procurement workspace.</p>

			<TabHelp tabKey="home" title="Welcome — here&rsquo;s where things live">
				<p style={{ margin: '0 0 6px' }}>
					Ebisu is organized around <strong>projects</strong>. Most of your day-to-day work
					(QAP edits, RFQs, sales orders, purchase orders, shipments, invoices, bills) happens
					inside a project. Open one from the list below or via the <strong>Projects</strong>{' '}
					link in the top nav.
				</p>
				<p style={{ margin: '6px 0' }}>The other top-level tabs:</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>Companies</strong> — the master list of clients, GCs, manufacturers, rep
						firms, and designers. This is also where you link a company to its QuickBooks
						Online Customer / Vendor record.
					</li>
					<li>
						<strong>Bills inbox</strong> — vendor bills awaiting review across all projects.
						Use this when a manufacturer email arrives and you need to triage.
					</li>
					<li>
						<strong>QBO</strong> — settings for the QuickBooks Online integration:
						connect/disconnect, default income/COGS accounts, sandbox vs production toggle.
					</li>
					<li>
						<strong>Help</strong> — long-form documentation on every concept. Each project
						sub-tab also has its own quick-help banner like this one.
					</li>
				</ul>
				<p style={{ margin: '6px 0 0' }}>
					Anywhere you see a yellow help banner you can dismiss it with the ✕ — your choice
					is remembered per browser. Click <em>ⓘ Show help</em> to bring it back.
				</p>
			</TabHelp>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
					gap: '10px',
					maxWidth: '900px',
					margin: '12px 0 20px'
				}}
			>
				<StatTile label="Projects" value={projectsCount?.n ?? 0} href="/projects" />
				<StatTile label="Companies" value={companiesCount?.n ?? 0} href="/companies" />
				<StatTile
					label="Bills awaiting review"
					value={billsPendingCount?.n ?? 0}
					href="/bills"
					highlight={(billsPendingCount?.n ?? 0) > 0}
				/>
				<StatTile
					label={`QBO (${activeQbo?.env ?? 'not connected'})`}
					value={activeQbo ? '●' : '○'}
					href="/qbo"
					muted={!activeQbo}
				/>
			</div>

			{missingClient > 0 && (
				<p className="flash info" style={{ maxWidth: '900px' }}>
					{missingClient} project{missingClient === 1 ? '' : 's'} {missingClient === 1 ? 'has' : 'have'} no
					client company set. Open the project, click <strong>Edit project</strong>, and pick the
					client so invoices can be pushed to QBO.
				</p>
			)}

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: '24px',
					maxWidth: '1100px'
				}}
			>
				<section>
					<h2 style={{ marginBottom: 8 }}>Recent projects</h2>
					{recentProjects.length === 0 ? (
						<p className="muted">
							No projects yet. <a href="/projects/new">Create one</a>.
						</p>
					) : (
						<>
							<table className="plain" style={{ fontSize: '13px' }}>
								<thead>
									<tr>
										<th>Project</th>
										<th>Phase</th>
										<th>Updated</th>
									</tr>
								</thead>
								<tbody>
									{recentProjects.map((p) => (
										<tr key={p.id}>
											<td>
												<a href={`/projects/${p.id}`}>{p.name}</a>
											</td>
											<td className="muted">
												{p.phase ?? '—'}
												{p.status && p.status !== 'active' && ` · ${p.status}`}
											</td>
											<td className="muted">
												{new Date(p.updatedAt).toLocaleDateString()}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<p style={{ marginTop: '8px' }}>
								<a href="/projects">→ all projects</a>
							</p>
						</>
					)}
				</section>

				<section>
					<h2 style={{ marginBottom: 8 }}>Cross-project tools</h2>
					<ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px' }}>
						<NavRow
							href="/projects"
							label="Projects"
							hint="Every project ILC is running, with status filters."
						/>
						<NavRow
							href="/companies"
							label="Companies"
							hint="Clients, GCs, designers, manufacturers, rep firms — all in one master list with QBO links."
						/>
						<NavRow
							href="/bills"
							label="Bills inbox"
							hint="Vendor bills awaiting review, across every project."
						/>
						<NavRow
							href="/qbo"
							label="QBO settings"
							hint="Connect / disconnect, default accounts, sandbox vs production."
						/>
						<NavRow
							href="/help"
							label="Help"
							hint="Long-form docs on every concept, with a glossary."
						/>
					</ul>
				</section>
			</div>
		</>
	);
}

function StatTile({
	label,
	value,
	href,
	highlight,
	muted
}: {
	label: string;
	value: string | number;
	href: string;
	highlight?: boolean;
	muted?: boolean;
}) {
	return (
		<a
			href={href}
			style={{
				textDecoration: 'none',
				color: 'inherit'
			}}
		>
			<div
				style={{
					padding: '10px 12px',
					background: highlight ? '#fff3cd' : '#fff',
					border: `1px solid ${highlight ? '#f0d878' : '#ddd'}`,
					borderRadius: '4px'
				}}
			>
				<div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
					{label}
				</div>
				<div
					style={{
						fontSize: '20px',
						fontWeight: 600,
						color: muted ? '#999' : highlight ? '#7a5d00' : '#111'
					}}
				>
					{value}
				</div>
			</div>
		</a>
	);
}

function NavRow({ href, label, hint }: { href: string; label: string; hint: string }) {
	return (
		<li
			style={{
				padding: '8px 0',
				borderBottom: '1px solid #eee'
			}}
		>
			<a href={href} style={{ fontWeight: 600 }}>
				{label}
			</a>
			<div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
				{hint}
			</div>
		</li>
	);
}
