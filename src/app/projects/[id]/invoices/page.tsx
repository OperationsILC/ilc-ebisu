import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	salesOrders,
	projects
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createDesignFeeInvoice, createCreditMemo } from './actions';

export default async function InvoicesListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: invoices.id,
			invoiceNo: invoices.invoiceNo,
			type: invoices.type,
			status: invoices.status,
			designPhase: invoices.designPhase,
			invoiceDate: invoices.invoiceDate,
			totalAmount: invoices.totalAmount,
			amountDue: invoices.amountDue,
			soId: invoices.salesOrderId,
			soNo: salesOrders.soNo,
			qboStatus: invoices.qboStatus,
			lineCount: sql<number>`(SELECT count(*) FROM ${invoiceLines} WHERE ${invoiceLines.invoiceId} = ${invoices.id})`
		})
		.from(invoices)
		.leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
		.where(eq(invoices.projectId, id))
		.orderBy(desc(invoices.createdAt));

	// Quick rollups
	const [counts] = await db
		.select({
			total: sql<number>`count(*)::int`,
			draft: sql<number>`count(*) filter (where ${invoices.status} = 'draft')::int`,
			sent: sql<number>`count(*) filter (where ${invoices.status} = 'sent')::int`,
			paid: sql<number>`count(*) filter (where ${invoices.status} = 'paid')::int`,
			pastDue: sql<number>`count(*) filter (where ${invoices.status} = 'past_due')::int`
		})
		.from(invoices)
		.where(eq(invoices.projectId, id));

	const designFeeBound = createDesignFeeInvoice.bind(null, id);
	const creditMemoBound = createCreditMemo.bind(null, id);

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>Invoices — {project.name}</h1>

			<p className="muted">
				Product invoices are created from a Sales Order. Design-fee invoices and credit memos are
				project-level.
			</p>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
					gap: '8px',
					maxWidth: '700px',
					margin: '12px 0 16px'
				}}
			>
				<MiniStat label="Total" value={counts?.total ?? 0} />
				<MiniStat label="Draft" value={counts?.draft ?? 0} />
				<MiniStat label="Sent" value={counts?.sent ?? 0} />
				<MiniStat label="Paid" value={counts?.paid ?? 0} highlight />
				<MiniStat label="Past due" value={counts?.pastDue ?? 0} danger />
			</div>

			<div style={{ display: 'flex', gap: '12px', margin: '12px 0' }}>
				<form action={designFeeBound}>
					<button className="primary" type="submit">
						+ Design-fee invoice
					</button>
				</form>
				<form action={creditMemoBound}>
					<button type="submit">+ Credit memo</button>
				</form>
				<span className="muted" style={{ alignSelf: 'center' }}>
					Product invoices: open a Sales Order, click <strong>+ New invoice</strong>.
				</span>
			</div>

			{rows.length === 0 ? (
				<p className="muted">No invoices yet.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1100px' }}>
					<thead>
						<tr>
							<th>INV #</th>
							<th>Type</th>
							<th>Status</th>
							<th>QBO</th>
							<th>Date</th>
							<th>SO</th>
							<th>Lines</th>
							<th style={{ textAlign: 'right' }}>Total</th>
							<th style={{ textAlign: 'right' }}>Due</th>
							<th>Phase</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${id}/invoices/${r.id}`}>{r.invoiceNo}</a>
								</td>
								<td>
									<TypeBadge type={r.type} />
								</td>
								<td>
									<StatusBadge status={r.status} />
								</td>
								<td>
									<QboBadge status={r.qboStatus} />
								</td>
								<td>{r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString() : '—'}</td>
								<td>
									{r.soNo ? (
										<a href={`/projects/${id}/sos/${r.soId}`}>{r.soNo}</a>
									) : (
										'—'
									)}
								</td>
								<td>{r.lineCount}</td>
								<td style={{ textAlign: 'right' }}>${Number(r.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
								<td style={{ textAlign: 'right' }}>
									${Number(r.amountDue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
								<td className="muted">{r.designPhase ?? '—'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

function MiniStat({
	label,
	value,
	highlight,
	danger
}: {
	label: string;
	value: number;
	highlight?: boolean;
	danger?: boolean;
}) {
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
			<div
				style={{
					fontSize: '16px',
					fontWeight: 600,
					color: danger ? '#c00' : highlight ? '#0a7c2f' : '#111'
				}}
			>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		partial_paid: { bg: '#cfe9ff', fg: '#0a3a6e' },
		paid: { bg: '#d4edda', fg: '#155724' },
		past_due: { bg: '#f5d6d6', fg: '#7a1212' },
		void: { bg: '#eee', fg: '#666' }
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
			{status.replace('_', ' ')}
		</span>
	);
}

function TypeBadge({ type }: { type: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		product: { bg: '#eef6ff', fg: '#234' },
		design_fee: { bg: '#fff3e0', fg: '#7a4500' },
		credit_memo: { bg: '#fce4ec', fg: '#7a1212' }
	};
	const c = colors[type] ?? { bg: '#eee', fg: '#333' };
	const labels: Record<string, string> = {
		product: 'PRODUCT',
		design_fee: 'DESIGN FEE',
		credit_memo: 'CREDIT'
	};
	return (
		<span
			style={{
				background: c.bg,
				color: c.fg,
				padding: '2px 6px',
				borderRadius: '3px',
				fontSize: '10px',
				fontWeight: 600
			}}
		>
			{labels[type] ?? type}
		</span>
	);
}

function QboBadge({ status }: { status: string }) {
	if (status === 'pushed') {
		return <span style={{ color: '#0a7c2f', fontSize: '11px' }}>● pushed</span>;
	}
	if (status === 'failed') {
		return <span style={{ color: '#c00', fontSize: '11px' }}>● failed</span>;
	}
	if (status === 'queued') {
		return <span style={{ color: '#7a5d00', fontSize: '11px' }}>● queued</span>;
	}
	return <span className="muted" style={{ fontSize: '11px' }}>○ not pushed</span>;
}
