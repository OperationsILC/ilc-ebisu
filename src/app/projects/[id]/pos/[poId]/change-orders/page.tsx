import { db } from '@/lib/db';
import {
	changeOrders,
	changeOrderLines,
	purchaseOrders,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createChangeOrder } from './actions';

export default async function ChangeOrdersListPage({
	params
}: {
	params: Promise<{ id: string; poId: string }>;
}) {
	const { id, poId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const poRow = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!poRow) notFound();

	const rows = await db
		.select({
			id: changeOrders.id,
			coNo: changeOrders.coNo,
			status: changeOrders.status,
			versionNoBefore: changeOrders.versionNoBefore,
			versionNoAfter: changeOrders.versionNoAfter,
			description: changeOrders.description,
			netAmountChange: changeOrders.netAmountChange,
			sentAt: changeOrders.sentAt,
			appliedAt: changeOrders.appliedAt,
			createdAt: changeOrders.createdAt,
			creator: users.email,
			lineCount: sql<number>`(SELECT count(*) FROM ${changeOrderLines} WHERE ${changeOrderLines.changeOrderId} = ${changeOrders.id})::int`
		})
		.from(changeOrders)
		.leftJoin(users, eq(changeOrders.createdByUserId, users.id))
		.where(eq(changeOrders.purchaseOrderId, poId))
		.orderBy(desc(changeOrders.createdAt));

	const hasOpenCo = rows.some((r) =>
		['draft', 'sent', 'acknowledged'].includes(r.status)
	);
	const poIsSent = ['sent', 'acknowledged', 'shipped', 'received'].includes(
		poRow.po.status
	);

	const createBound = createChangeOrder.bind(null, id, poId);

	return (
		<>
			<p>
				<a href={`/projects/${id}/pos/${poId}`}>
					← {poRow.po.poNo} ({poRow.repFirm ?? 'no rep firm'})
				</a>
			</p>

			<h1>
				Change Orders — {poRow.po.poNo}{' '}
				<a href="/help/purchase-orders" target="_blank" rel="noopener" style={{ fontSize: '13px', fontWeight: 'normal' }}>
					(help ↗)
				</a>
			</h1>

			<p className="muted">
				PO is at <strong>v{poRow.po.versionNo}</strong>. A CO captures changes against a sent
				PO and bumps the version when applied.
			</p>

			{poIsSent ? (
				hasOpenCo ? (
					<p className="flash info">
						This PO has an open Change Order already. Apply or cancel it before creating
						another.
					</p>
				) : (
					<form action={createBound} style={{ margin: '12px 0' }}>
						<button className="primary" type="submit">
							+ New Change Order
						</button>
					</form>
				)
			) : (
				<p className="flash info">
					Change Orders are for PO that&apos;s already <code>sent</code>. This PO is{' '}
					<strong>{poRow.po.status}</strong> — edit lines on the PO workbench directly.
				</p>
			)}

			{rows.length === 0 ? (
				<p className="muted">No change orders.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1100px' }}>
					<thead>
						<tr>
							<th>CO #</th>
							<th>Status</th>
							<th>Lines</th>
							<th style={{ textAlign: 'right' }}>Net change</th>
							<th>Version</th>
							<th>Description</th>
							<th>Sent</th>
							<th>Applied</th>
							<th>Creator</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${id}/pos/${poId}/change-orders/${r.id}`}>{r.coNo}</a>
								</td>
								<td>
									<StatusBadge status={r.status} />
								</td>
								<td>{r.lineCount}</td>
								<td style={{ textAlign: 'right' }}>
									{Number(r.netAmountChange ?? 0) !== 0 && (
										<span
											style={{
												color: Number(r.netAmountChange) > 0 ? '#7a1212' : '#0a7c2f',
												fontWeight: 600
											}}
										>
											{Number(r.netAmountChange) > 0 ? '+' : ''}
											{Number(r.netAmountChange ?? 0).toLocaleString('en-US', {
												style: 'currency',
												currency: 'USD',
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}
										</span>
									)}
								</td>
								<td className="muted">
									v{r.versionNoBefore}
									{r.versionNoAfter && ` → v${r.versionNoAfter}`}
								</td>
								<td className="muted">{r.description ?? '—'}</td>
								<td>{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</td>
								<td>{r.appliedAt ? new Date(r.appliedAt).toLocaleDateString() : '—'}</td>
								<td className="muted" style={{ fontSize: '11px' }}>
									{r.creator ?? '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		acknowledged: { bg: '#cfe9ff', fg: '#0a3a6e' },
		applied: { bg: '#d4edda', fg: '#155724' },
		rejected: { bg: '#f5d6d6', fg: '#7a1212' },
		cancelled: { bg: '#eee', fg: '#666' }
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
