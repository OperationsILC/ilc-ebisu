import { db } from '@/lib/db';
import { budgets, budgetLines, projects } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createBudget } from './actions';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export default async function BudgetsListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	// Each budget with a computed total (sum of qty × unit_dn × (1 + margin%))
	const rows = await db
		.select({
			id: budgets.id,
			budgetNo: budgets.budgetNo,
			status: budgets.status,
			description: budgets.description,
			marginPct: budgets.marginPct,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${budgetLines} WHERE ${budgetLines.budgetId} = ${budgets.id})::int`,
			dnTotal: sql<string>`(SELECT coalesce(sum(${budgetLines.qty} * ${budgetLines.unitDn}), 0) FROM ${budgetLines} WHERE ${budgetLines.budgetId} = ${budgets.id})`
		})
		.from(budgets)
		.where(eq(budgets.projectId, id))
		.orderBy(desc(budgets.createdAt));

	const targetBudget = Number(project.targetBudgetTotal ?? 0);
	const targetDollarsPerSf = Number(project.targetDollarsPerSf ?? 0);
	const totalSf = Number(project.totalSf ?? 0);

	const createBound = createBudget.bind(null, id);

	return (
		<>
			<p>
				<a href={`/projects/${id}`}>← {project.name}</a>
			</p>

			<h1>
				Budgets — {project.name}{' '}
				<a href="/help/budgets" target="_blank" rel="noopener" style={{ fontSize: '13px', fontWeight: 'normal' }}>
					(help ↗)
				</a>
			</h1>
			<p className="muted">
				Versioned snapshots of the QAP&apos;s pricing at design milestones. Each budget freezes
				a moment in time so PMs can compare against earlier versions and against project
				targets.
			</p>

			{(targetBudget > 0 || targetDollarsPerSf > 0 || totalSf > 0) && (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
						gap: '8px',
						maxWidth: '700px',
						margin: '12px 0 16px'
					}}
				>
					{targetBudget > 0 && <Stat label="Target budget" value={usd.format(targetBudget)} />}
					{targetDollarsPerSf > 0 && (
						<Stat label="Target $/SF" value={usd.format(targetDollarsPerSf)} />
					)}
					{totalSf > 0 && <Stat label="Total SF" value={totalSf.toLocaleString()} />}
				</div>
			)}

			<form action={createBound} style={{ margin: '12px 0' }}>
				<button className="primary" type="submit">
					+ New budget
				</button>
			</form>

			{rows.length === 0 ? (
				<p className="muted">No budgets yet.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px' }}>
					<thead>
						<tr>
							<th>BUDGET #</th>
							<th>Status</th>
							<th>Description</th>
							<th>Lines</th>
							<th style={{ textAlign: 'right' }}>DN Total</th>
							<th style={{ textAlign: 'right' }}>CN Total</th>
							<th style={{ textAlign: 'right' }}>Profit</th>
							<th style={{ textAlign: 'right' }}>$/SF</th>
							<th style={{ textAlign: 'right' }}>vs target</th>
							<th>Updated</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((b) => {
							const dn = Number(b.dnTotal ?? 0);
							const margin = Number(b.marginPct ?? 0);
							const cn = dn * (1 + margin / 100);
							const profit = cn - dn;
							const dollarsPerSf = totalSf > 0 ? cn / totalSf : 0;
							const vsTarget = targetBudget > 0 ? cn - targetBudget : null;
							return (
								<tr key={b.id}>
									<td>
										<a href={`/projects/${id}/budgets/${b.id}`}>{b.budgetNo}</a>
									</td>
									<td>
										<StatusBadge status={b.status} />
									</td>
									<td className="muted">{b.description ?? '—'}</td>
									<td>{b.lineCount}</td>
									<td style={{ textAlign: 'right' }}>{usd.format(dn)}</td>
									<td style={{ textAlign: 'right' }}>{usd.format(cn)}</td>
									<td style={{ textAlign: 'right', color: profit >= 0 ? '#0a7c2f' : '#7a1212' }}>
										{usd.format(profit)}
									</td>
									<td style={{ textAlign: 'right' }}>
										{dollarsPerSf > 0 ? usd.format(dollarsPerSf) : '—'}
									</td>
									<td
										style={{
											textAlign: 'right',
											color: vsTarget === null
												? '#999'
												: vsTarget > 0
													? '#7a1212'
													: '#0a7c2f',
											fontWeight: 600
										}}
									>
										{vsTarget !== null
											? `${vsTarget > 0 ? '+' : ''}${usd.format(vsTarget)}`
											: '—'}
									</td>
									<td className="muted">
										{new Date(b.updatedAt).toLocaleDateString()}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div
			style={{
				padding: '8px 10px',
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '16px', fontWeight: 600 }}>{value}</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		confirmed: { bg: '#d4edda', fg: '#155724' },
		archived: { bg: '#eee', fg: '#666' }
	};
	const c = colors[status] ?? { bg: '#eee', fg: '#333' };
	return (
		<span
			style={{
				background: c.bg,
				color: c.fg,
				padding: '2px 6px',
				borderRadius: '3px',
				fontSize: '11px',
				textTransform: 'uppercase',
				fontWeight: 600
			}}
		>
			{status}
		</span>
	);
}
