import { db } from '@/lib/db';
import {
	bills,
	billLines,
	purchaseOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, desc, sql, isNull } from 'drizzle-orm';

/**
 * Global bills inbox — surfaces every bill in the system, with emphasis on
 * pending_review and unmatched-to-project bills (those won't appear on any
 * per-project list).
 */
export default async function BillsInboxPage() {
	const unmatchedCount = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(bills)
		.where(isNull(bills.projectId))
		.then((r) => Number(r[0]?.n ?? 0));

	const allCount = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(bills)
		.then((r) => Number(r[0]?.n ?? 0));

	const rows = await db
		.select({
			id: bills.id,
			billNo: bills.billNo,
			vendorBillNo: bills.vendorBillNo,
			status: bills.status,
			projectId: bills.projectId,
			projectName: projects.name,
			poNo: purchaseOrders.poNo,
			poId: bills.purchaseOrderId,
			vendor: companies.name,
			billDate: bills.billDate,
			dueDate: bills.dueDate,
			totalAmount: bills.totalAmount,
			qboStatus: bills.qboStatus,
			lineCount: sql<number>`(SELECT count(*) FROM ${billLines} WHERE ${billLines.billId} = ${bills.id})`,
			createdAt: bills.createdAt
		})
		.from(bills)
		.leftJoin(projects, eq(bills.projectId, projects.id))
		.leftJoin(purchaseOrders, eq(bills.purchaseOrderId, purchaseOrders.id))
		.leftJoin(companies, eq(bills.vendorCompanyId, companies.id))
		.orderBy(desc(bills.createdAt));

	return (
		<>
			<h1>Bills inbox</h1>
			<p className="muted">
				All bills across all projects, including unmatched bills (no project linked yet). Match
				them by clicking through and entering the correct PO number.
			</p>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					gap: '8px',
					maxWidth: '600px',
					margin: '12px 0 16px'
				}}
			>
				<MiniStat label="Total bills" value={allCount} />
				<MiniStat label="Unmatched" value={unmatchedCount} danger={unmatchedCount > 0} />
			</div>

			{rows.length === 0 ? (
				<p className="muted">No bills.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px' }}>
					<thead>
						<tr>
							<th>BILL #</th>
							<th>VENDOR BILL #</th>
							<th>Vendor</th>
							<th>Project</th>
							<th>PO</th>
							<th>Status</th>
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
									{r.projectId ? (
										<a href={`/projects/${r.projectId}/bills/${r.id}`}>{r.billNo}</a>
									) : (
										<a href={`/bills/${r.id}`}>{r.billNo}</a>
									)}
								</td>
								<td className="muted">{r.vendorBillNo ?? '—'}</td>
								<td>{r.vendor ?? '—'}</td>
								<td>
									{r.projectName ? (
										<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
									) : (
										<span style={{ color: '#c00' }}>unmatched</span>
									)}
								</td>
								<td>
									{r.poNo ? (
										<a href={`/projects/${r.projectId}/pos/${r.poId}`}>{r.poNo}</a>
									) : (
										<span style={{ color: '#c00' }}>—</span>
									)}
								</td>
								<td>
									<StatusBadge status={r.status} />
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
	danger
}: {
	label: string;
	value: number;
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
					color: danger ? '#c00' : '#111'
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
