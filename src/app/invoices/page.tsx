import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	salesOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import TabHelp from '@/app/components/TabHelp';

const INVOICE_STATUSES = ['draft', 'sent', 'partial_paid', 'paid', 'past_due', 'void'];
const INVOICE_TYPES = ['product', 'design_fee', 'credit_memo'];

export default async function GlobalInvoicesPage({
	searchParams
}: {
	searchParams: Promise<{ project?: string; status?: string; type?: string }>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const statusFilter = (sp.status ?? '').trim();
	const typeFilter = (sp.type ?? '').trim();

	const conditions = [];
	if (projectFilter !== '') conditions.push(eq(invoices.projectId, projectFilter));
	if (statusFilter !== '') conditions.push(eq(invoices.status, statusFilter));
	if (typeFilter !== '') conditions.push(eq(invoices.type, typeFilter));
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: invoices.id,
			invoiceNo: invoices.invoiceNo,
			type: invoices.type,
			status: invoices.status,
			projectId: invoices.projectId,
			projectName: projects.name,
			clientCompany: companies.name,
			soNo: salesOrders.soNo,
			soId: salesOrders.id,
			invoiceDate: invoices.invoiceDate,
			dueDate: invoices.dueDate,
			totalAmount: invoices.totalAmount,
			amountDue: invoices.amountDue,
			qboStatus: invoices.qboStatus,
			lineCount: sql<number>`(SELECT count(*) FROM ${invoiceLines} WHERE ${invoiceLines.invoiceId} = ${invoices.id})::int`
		})
		.from(invoices)
		.innerJoin(projects, eq(invoices.projectId, projects.id))
		.leftJoin(companies, eq(companies.id, projects.clientCompanyId))
		.leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
		.where(whereClause)
		.orderBy(desc(invoices.createdAt));

	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(invoices)
		.innerJoin(projects, eq(invoices.projectId, projects.id))
		.orderBy(projects.name);

	const statusCounts = await db
		.select({ status: invoices.status, n: sql<number>`count(*)::int` })
		.from(invoices)
		.groupBy(invoices.status);
	const countByStatus = new Map(statusCounts.map((r) => [r.status, r.n]));

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	const totalDue = rows.reduce((sum, r) => sum + Number(r.amountDue ?? 0), 0);

	return (
		<>
			<h1>Invoices — all projects</h1>

			<TabHelp tabKey="invoices-global" title="Cross-project Invoice workspace (AR)">
				<p style={{ margin: '0 0 6px' }}>
					Every invoice ILC has issued to a client, across every project. This is your
					accounts-receivable rollup view.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>Types</strong>: <code>product</code> (billing delivered fixtures) ·{' '}
						<code>design_fee</code> (phase milestone billing) · <code>credit_memo</code>{' '}
						(client credit, negative amount).
					</li>
					<li>
						<strong>Status</strong>: <code>draft</code> → <code>sent</code> →{' '}
						<code>partial_paid</code> / <code>paid</code>. <code>past_due</code> flags
						overdue invoices. <code>void</code> cancels.
					</li>
					<li>
						The QBO column shows whether each invoice has been pushed to QuickBooks
						Online. Click an invoice to open it and push from its detail page.
					</li>
				</ul>
			</TabHelp>

			<StatusRow countByStatus={countByStatus} kind="inv" />

			<form method="get" style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end', flexWrap: 'wrap' }}>
				<label>
					Project
					<br />
					<select name="project" defaultValue={projectFilter} style={{ minWidth: '200px' }}>
						<option value="">All projects</option>
						{projectOptions.map((p) => (
							<option key={p.id} value={p.id}>{p.name}</option>
						))}
					</select>
				</label>
				<label>
					Type
					<br />
					<select name="type" defaultValue={typeFilter} style={{ minWidth: '140px' }}>
						<option value="">All types</option>
						{INVOICE_TYPES.map((t) => (
							<option key={t} value={t}>{t.replace('_', ' ')}</option>
						))}
					</select>
				</label>
				<label>
					Status
					<br />
					<select name="status" defaultValue={statusFilter} style={{ minWidth: '140px' }}>
						<option value="">All statuses</option>
						{INVOICE_STATUSES.map((s) => (
							<option key={s} value={s}>{s.replace('_', ' ')}</option>
						))}
					</select>
				</label>
				<button type="submit">Filter</button>
				{(projectFilter || statusFilter || typeFilter) && (
					<a href="/invoices" className="muted" style={{ marginLeft: '8px' }}>Clear</a>
				)}
			</form>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} invoice{rows.length === 1 ? '' : 's'} ·{' '}
				<strong>{usd.format(totalDue)}</strong> outstanding across filtered rows.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No invoices match the current filters.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1400px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>INVOICE NO</th>
							<th>Project</th>
							<th>Client</th>
							<th>Type</th>
							<th>From SO</th>
							<th style={{ textAlign: 'right' }}>Total</th>
							<th style={{ textAlign: 'right' }}>Due</th>
							<th>Status</th>
							<th>QBO</th>
							<th>Date</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${r.projectId}/invoices/${r.id}`}>
										{r.invoiceNo}
									</a>
								</td>
								<td>
									<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
								</td>
								<td>{r.clientCompany ?? '—'}</td>
								<td>{r.type.replace('_', ' ')}</td>
								<td>
									{r.soNo ? (
										<a href={`/projects/${r.projectId}/sos/${r.soId}`}>{r.soNo}</a>
									) : (
										'—'
									)}
								</td>
								<td style={{ textAlign: 'right' }}>
									{r.totalAmount ? usd.format(Number(r.totalAmount)) : '—'}
								</td>
								<td style={{ textAlign: 'right' }}>
									{r.amountDue && Number(r.amountDue) > 0
										? usd.format(Number(r.amountDue))
										: '—'}
								</td>
								<td>{r.status.replace('_', ' ')}</td>
								<td className="muted" style={{ fontSize: '11px' }}>
									{r.qboStatus === 'pushed' ? (
										<span style={{ color: '#0a7c2f' }}>● pushed</span>
									) : r.qboStatus === 'failed' ? (
										<span style={{ color: '#c00' }}>● failed</span>
									) : (
										<span>○ not pushed</span>
									)}
								</td>
								<td className="muted">
									{r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString() : '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

function StatusRow({
	countByStatus,
	kind
}: {
	countByStatus: Map<string, number>;
	kind: string;
}) {
	const total = Array.from(countByStatus.values()).reduce((a, b) => a + b, 0);
	const entries = Array.from(countByStatus.entries());
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`,
				gap: '8px',
				maxWidth: '900px',
				margin: '12px 0'
			}}
		>
			<MiniTile label="Total" value={total} />
			{entries.map(([s, n]) => (
				<MiniTile key={`${kind}-${s}`} label={s.replace('_', ' ')} value={n} />
			))}
		</div>
	);
}

function MiniTile({ label, value }: { label: string; value: number }) {
	return (
		<div
			style={{
				padding: '6px 10px',
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
