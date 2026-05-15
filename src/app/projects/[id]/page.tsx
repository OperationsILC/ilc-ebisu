import { db } from '@/lib/db';
import {
	projects,
	qapLines,
	products,
	companies,
	rfqs,
	salesOrders,
	purchaseOrders,
	shipments,
	invoices,
	bills,
	budgets
} from '@/lib/db/schema';
import { eq, count, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});
const num = new Intl.NumberFormat('en-US');

export default async function ProjectDetailPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	// Rollup stats in one query — uses PostgreSQL FILTER and SUM aggregates.
	const [rollup] = await db
		.select({
			totalLines: count(),
			linesWithBoth: sql<string>`count(*) filter (where ${qapLines.qty} is not null and ${qapLines.currentDn} is not null)`,
			totalQty: sql<string>`coalesce(sum(${qapLines.qty}), 0)`,
			totalDealerNet: sql<string>`coalesce(sum(${qapLines.qty} * ${qapLines.currentDn}), 0)`,
			linesMissingQty: sql<string>`count(*) filter (where ${qapLines.qty} is null)`,
			linesMissingDn: sql<string>`count(*) filter (where ${qapLines.currentDn} is null)`,
			distinctMfrs: sql<string>`count(distinct ${products.manufacturerCompanyId})`,
			distinctTypes: sql<string>`count(distinct ${qapLines.typeId})`
		})
		.from(qapLines)
		.innerJoin(products, eq(qapLines.productId, products.id))
		.where(eq(qapLines.projectId, id));

	const [{ rfqCount }] = await db
		.select({ rfqCount: count() })
		.from(rfqs)
		.where(eq(rfqs.projectId, id));

	const [{ soCount }] = await db
		.select({ soCount: count() })
		.from(salesOrders)
		.where(eq(salesOrders.projectId, id));

	const [{ poCount }] = await db
		.select({ poCount: count() })
		.from(purchaseOrders)
		.where(eq(purchaseOrders.projectId, id));

	const [{ shipmentCount }] = await db
		.select({ shipmentCount: count() })
		.from(shipments)
		.where(eq(shipments.projectId, id));

	const [{ invoiceCount }] = await db
		.select({ invoiceCount: count() })
		.from(invoices)
		.where(eq(invoices.projectId, id));

	const [{ billCount }] = await db
		.select({ billCount: count() })
		.from(bills)
		.where(eq(bills.projectId, id));

	const [{ budgetCount }] = await db
		.select({ budgetCount: count() })
		.from(budgets)
		.where(eq(budgets.projectId, id));

	// Top 5 manufacturers by line count
	const topMfrs = await db
		.select({
			mfr: companies.name,
			n: count()
		})
		.from(qapLines)
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(eq(qapLines.projectId, id))
		.groupBy(companies.name)
		.orderBy(desc(count()))
		.limit(5);

	const totalLines = Number(rollup?.totalLines ?? 0);
	const totalQty = Number(rollup?.totalQty ?? 0);
	const totalDealerNet = Number(rollup?.totalDealerNet ?? 0);
	const marginPct = Number(project.marginPct ?? 0);
	const totalClientNet = totalDealerNet * (1 + marginPct / 100);
	const linesMissingQty = Number(rollup?.linesMissingQty ?? 0);
	const linesMissingDn = Number(rollup?.linesMissingDn ?? 0);
	const distinctMfrs = Number(rollup?.distinctMfrs ?? 0);
	const distinctTypes = Number(rollup?.distinctTypes ?? 0);

	const p = project;

	return (
		<>
			<p>
				<a href="/projects">← all projects</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>{p.name}</h1>
				<a href={`/projects/${p.id}/edit`} style={{ fontSize: '13px' }}>
					Edit project ↗
				</a>
			</div>
			<p className="muted">
				{p.status}
				{p.phase && <> · {p.phase}</>}
				{p.projectType && <> · {p.projectType}</>}
				 · created {new Date(p.createdAt).toLocaleDateString()}
			</p>

			<div style={{ display: 'flex', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
				<a href={`/projects/${p.id}/budgets`}>
					<button>Budgets ({budgetCount})</button>
				</a>
				<a href={`/projects/${p.id}/qap`}>
					<button className="primary">Open QAP ({totalLines} lines)</button>
				</a>
				<a href={`/projects/${p.id}/qap/import`}>
					<button>Import CSV</button>
				</a>
				<a href={`/projects/${p.id}/rfqs`}>
					<button>RFQs ({rfqCount})</button>
				</a>
				<a href={`/projects/${p.id}/sos`}>
					<button>Sales Orders ({soCount})</button>
				</a>
				<a href={`/projects/${p.id}/pos`}>
					<button>Purchase Orders ({poCount})</button>
				</a>
				<a href={`/projects/${p.id}/shipments`}>
					<button>Shipments ({shipmentCount})</button>
				</a>
				<a href={`/projects/${p.id}/invoices`}>
					<button>Invoices ({invoiceCount})</button>
				</a>
				<a href={`/projects/${p.id}/bills`}>
					<button>Bills ({billCount})</button>
				</a>
			</div>

			{totalLines > 0 && (
				<>
					<h2 style={{ marginTop: '24px' }}>Rollup</h2>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
							gap: '12px',
							maxWidth: '900px',
							marginBottom: '16px'
						}}
					>
						<Stat label="QAP lines" value={num.format(totalLines)} />
						<Stat label="Total QTY" value={num.format(totalQty)} />
						<Stat label="Unique mfrs" value={num.format(distinctMfrs)} />
						<Stat label="Unique types" value={num.format(distinctTypes)} />
						<Stat
							label="Est. dealer-net total"
							value={usd.format(totalDealerNet)}
							muted={totalDealerNet === 0}
						/>
						<Stat
							label={`Est. client-net (at ${marginPct}% margin)`}
							value={usd.format(totalClientNet)}
							muted={totalClientNet === 0}
						/>
					</div>

					{(linesMissingQty > 0 || linesMissingDn > 0) && (
						<p className="flash info">
							<strong>Data completeness:</strong>{' '}
							{linesMissingQty > 0 && (
								<>
									{linesMissingQty} line{linesMissingQty === 1 ? '' : 's'} missing QTY
								</>
							)}
							{linesMissingQty > 0 && linesMissingDn > 0 && ' · '}
							{linesMissingDn > 0 && (
								<>
									{linesMissingDn} line{linesMissingDn === 1 ? '' : 's'} missing CURRENT DN
								</>
							)}
							. The totals above are computed from rows that have both set.
						</p>
					)}

					{topMfrs.length > 0 && (
						<>
							<h3>Manufacturers on this project</h3>
							<table className="plain" style={{ maxWidth: '500px' }}>
								<thead>
									<tr>
										<th>Manufacturer</th>
										<th style={{ textAlign: 'right' }}>Lines</th>
										<th style={{ textAlign: 'right' }}>%</th>
									</tr>
								</thead>
								<tbody>
									{topMfrs.map((m, i) => (
										<tr key={i}>
											<td>{m.mfr ?? '(unknown)'}</td>
											<td style={{ textAlign: 'right' }}>{m.n}</td>
											<td style={{ textAlign: 'right' }}>
												{((Number(m.n) / totalLines) * 100).toFixed(0)}%
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</>
					)}
				</>
			)}

			<h2 style={{ marginTop: '24px' }}>Settings</h2>
			<table className="plain" style={{ maxWidth: '900px' }}>
				<tbody>
					<tr>
						<th>Service type</th>
						<td>{p.serviceType ?? '—'}</td>
					</tr>
					<tr>
						<th>Margin %</th>
						<td>{p.marginPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Freight %</th>
						<td>{p.freightPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Warehousing %</th>
						<td>{p.warehousingPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Sales tax</th>
						<td>
							{p.salesTaxPct ? `${p.salesTaxPct}%` : '—'}
							{p.salesTaxName && <span className="muted"> · {p.salesTaxName}</span>}
						</td>
					</tr>
					<tr>
						<th>Projected design fee total</th>
						<td>{p.projectedDesignFeeTotal ? `$${p.projectedDesignFeeTotal}` : '—'}</td>
					</tr>
					<tr>
						<th>IFC sub date</th>
						<td>{p.ifcSubDate ? new Date(p.ifcSubDate).toLocaleDateString() : '—'}</td>
					</tr>
					<tr>
						<th>Expected order date</th>
						<td>{p.expectedOrderDate ? new Date(p.expectedOrderDate).toLocaleDateString() : '—'}</td>
					</tr>
					<tr>
						<th>Delivery address</th>
						<td>
							{[p.deliveryStreet, p.deliveryCity, p.deliveryState, p.deliveryZip]
								.filter(Boolean)
								.join(' ') || '—'}
							{p.deliverySiteContactName && (
								<div className="muted">
									{p.deliverySiteContactName}
									{p.deliverySiteContactPhone && ` · ${p.deliverySiteContactPhone}`}
								</div>
							)}
						</td>
					</tr>
					<tr>
						<th>Job site address</th>
						<td>
							{[p.siteStreet, p.siteCity, p.siteState, p.siteZip]
								.filter(Boolean)
								.join(' ') || '—'}
							{p.jobSiteContactName && (
								<div className="muted">
									{p.jobSiteContactName}
									{p.jobSiteContactPhone && ` · ${p.jobSiteContactPhone}`}
								</div>
							)}
						</td>
					</tr>
					<tr>
						<th>Square footage</th>
						<td>
							{p.totalSf
								? `${num.format(p.totalSf)} SF total`
								: '—'}
							{p.interiorSf ? ` · ${num.format(p.interiorSf)} interior` : ''}
							{p.exteriorSf ? ` · ${num.format(p.exteriorSf)} exterior` : ''}
							{p.numUnitsRooms ? ` · ${num.format(p.numUnitsRooms)} units/rooms` : ''}
						</td>
					</tr>
					<tr>
						<th>Project emails</th>
						<td>
							{p.emailsForBudgets || p.emailsForQuotesSo || p.emailsForShipmentUpdates ? (
								<>
									{p.emailsForBudgets && (
										<div>
											<span className="muted">Budgets:</span> {p.emailsForBudgets}
										</div>
									)}
									{p.emailsForQuotesSo && (
										<div>
											<span className="muted">Quotes/SOs:</span> {p.emailsForQuotesSo}
										</div>
									)}
									{p.emailsForShipmentUpdates && (
										<div>
											<span className="muted">Shipment updates:</span>{' '}
											{p.emailsForShipmentUpdates}
										</div>
									)}
								</>
							) : (
								<span className="muted">— (using company defaults)</span>
							)}
						</td>
					</tr>
					{p.description && (
						<tr>
							<th>Description</th>
							<td>{p.description}</td>
						</tr>
					)}
					{p.notes && (
						<tr>
							<th>Notes</th>
							<td style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</td>
						</tr>
					)}
					{p.projectStats && (
						<tr>
							<th>Project stats</th>
							<td style={{ whiteSpace: 'pre-wrap' }}>{p.projectStats}</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	);
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
	return (
		<div
			style={{
				padding: '10px 12px',
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '20px', fontWeight: 600, color: muted ? '#999' : '#111' }}>
				{value}
			</div>
		</div>
	);
}
