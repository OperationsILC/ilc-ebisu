import { db } from '@/lib/db';
import {
	bills,
	billLines,
	purchaseOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createBlankBill } from './actions';

export default async function BillsListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: bills.id,
			billNo: bills.billNo,
			vendorBillNo: bills.vendorBillNo,
			status: bills.status,
			poNo: purchaseOrders.poNo,
			poId: bills.purchaseOrderId,
			vendor: companies.name,
			billDate: bills.billDate,
			dueDate: bills.dueDate,
			totalAmount: bills.totalAmount,
			qboStatus: bills.qboStatus,
			lineCount: sql<number>`(SELECT count(*) FROM ${billLines} WHERE ${billLines.billId} = ${bills.id})`
		})
		.from(bills)
		.leftJoin(purchaseOrders, eq(bills.purchaseOrderId, purchaseOrders.id))
		.leftJoin(companies, eq(bills.vendorCompanyId, companies.id))
		.where(eq(bills.projectId, id))
		.orderBy(desc(bills.createdAt));

	const [counts] = await db
		.select({
			total: sql<number>`count(*)::int`,
			pending: sql<number>`count(*) filter (where ${bills.status} = 'pending_review')::int`,
			approved: sql<number>`count(*) filter (where ${bills.status} = 'approved')::int`,
			paid: sql<number>`count(*) filter (where ${bills.status} = 'paid')::int`,
			rejected: sql<number>`count(*) filter (where ${bills.status} = 'rejected')::int`
		})
		.from(bills)
		.where(eq(bills.projectId, id));

	const createBound = createBlankBill.bind(null, id);

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>
				Bills — {project.name}{' '}
				<a href="/help/bills" target="_blank" rel="noopener" style={{ fontSize: '13px', fontWeight: 'normal' }}>
					(help ↗)
				</a>
			</h1>

			<p className="muted">
				Bills arrive via DocParser webhook (OCR&apos;d from emailed PDF) or manual entry. PMs
				review fields against the source PDF, attach the matching PO, then approve. Approved
				bills push to QBO.
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
				<MiniStat label="Pending" value={counts?.pending ?? 0} highlight={Number(counts?.pending ?? 0) > 0} />
				<MiniStat label="Approved" value={counts?.approved ?? 0} />
				<MiniStat label="Paid" value={counts?.paid ?? 0} />
				<MiniStat label="Rejected" value={counts?.rejected ?? 0} muted />
			</div>

			<form action={createBound} style={{ margin: '12px 0' }}>
				<button className="primary" type="submit">
					+ New bill (manual)
				</button>
			</form>

			{rows.length === 0 ? (
				<p className="muted">No bills yet.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px' }}>
					<thead>
						<tr>
							<th>BILL #</th>
							<th>VENDOR BILL #</th>
							<th>Status</th>
							<th>QBO</th>
							<th>Vendor</th>
							<th>PO</th>
							<th>Lines</th>
							<th>Bill date</th>
							<th>Due</th>
							<th style={{ textAlign: 'right' }}>Total</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${id}/bills/${r.id}`}>{r.billNo}</a>
								</td>
								<td className="muted">{r.vendorBillNo ?? '—'}</td>
								<td>
									<StatusBadge status={r.status} />
								</td>
								<td>
									<QboBadge status={r.qboStatus} />
								</td>
								<td>{r.vendor ?? '—'}</td>
								<td>
									{r.poNo ? (
										<a href={`/projects/${id}/pos/${r.poId}`}>{r.poNo}</a>
									) : (
										<span style={{ color: '#c00' }}>unattached</span>
									)}
								</td>
								<td>{r.lineCount}</td>
								<td>{r.billDate ? new Date(r.billDate).toLocaleDateString() : '—'}</td>
								<td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</td>
								<td style={{ textAlign: 'right' }}>
									${Number(r.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
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
	muted
}: {
	label: string;
	value: number;
	highlight?: boolean;
	muted?: boolean;
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
					color: muted ? '#999' : highlight ? '#c00' : '#111'
				}}
			>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		pending_review: { bg: '#fff3cd', fg: '#7a5d00' },
		approved: { bg: '#d4edda', fg: '#155724' },
		scheduled: { bg: '#cfe9ff', fg: '#0a3a6e' },
		paid: { bg: '#d4edda', fg: '#155724' },
		rejected: { bg: '#f5d6d6', fg: '#7a1212' },
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

function QboBadge({ status }: { status: string }) {
	if (status === 'pushed') return <span style={{ color: '#0a7c2f', fontSize: '11px' }}>● QBO</span>;
	if (status === 'failed') return <span style={{ color: '#c00', fontSize: '11px' }}>● failed</span>;
	if (status === 'queued') return <span style={{ color: '#7a5d00', fontSize: '11px' }}>● queued</span>;
	return <span className="muted" style={{ fontSize: '11px' }}>○ —</span>;
}
