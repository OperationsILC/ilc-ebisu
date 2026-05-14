import { db } from '@/lib/db';
import { companies, companyRoles } from '@/lib/db/schema';
import { asc, sql } from 'drizzle-orm';

export default async function CompaniesListPage({
	searchParams
}: {
	searchParams: Promise<{ q?: string; role?: string }>;
}) {
	const { q, role } = await searchParams;
	const search = (q ?? '').trim();
	const roleFilter = (role ?? '').trim();

	// Pull all companies with their roles in one shot. Use a json_agg subquery
	// rather than two passes.
	let whereClause = sql`true`;
	if (search !== '') {
		whereClause = sql`${companies.name} ilike ${'%' + search + '%'}`;
	}
	if (roleFilter !== '') {
		whereClause = sql`${whereClause} AND EXISTS (
			SELECT 1 FROM ${companyRoles}
			WHERE ${companyRoles.companyId} = ${companies.id}
				AND ${companyRoles.role} = ${roleFilter}
		)`;
	}

	const rows = await db
		.select({
			id: companies.id,
			name: companies.name,
			city: companies.city,
			state: companies.state,
			quoteEmails: companies.quoteEmails,
			orderEmails: companies.orderEmails,
			qboCustomerId: companies.qboCustomerId,
			qboVendorId: companies.qboVendorId,
			roles: sql<string>`(SELECT string_agg(${companyRoles.role}, ',') FROM ${companyRoles} WHERE ${companyRoles.companyId} = ${companies.id})`
		})
		.from(companies)
		.where(whereClause)
		.orderBy(asc(companies.name));

	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(companies);

	return (
		<>
			<h1>Companies</h1>
			<p className="muted">
				Manufacturers, rep firms, clients, GCs, and designers. The same company can wear
				multiple hats — e.g., LOGIQ SUPPLY is both manufacturer and rep firm.
			</p>

			<form
				method="get"
				style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end' }}
			>
				<label>
					Search by name
					<br />
					<input
						name="q"
						type="text"
						defaultValue={search}
						placeholder="e.g. Logiq"
						style={{ width: '240px' }}
					/>
				</label>
				<label>
					Filter by role
					<br />
					<select name="role" defaultValue={roleFilter} style={{ minWidth: '160px' }}>
						<option value="">All roles</option>
						<option value="manufacturer">Manufacturer</option>
						<option value="rep_firm">Rep firm</option>
						<option value="client">Client</option>
						<option value="gc">General contractor</option>
						<option value="designer">Designer</option>
					</select>
				</label>
				<button type="submit">Filter</button>
				{(search || roleFilter) && (
					<a href="/companies" className="muted" style={{ marginLeft: '8px' }}>
						Clear
					</a>
				)}
				<a href="/companies/new" style={{ marginLeft: 'auto' }}>
					<button className="primary" type="button">
						+ New company
					</button>
				</a>
			</form>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} of {total} compan{total === 1 ? 'y' : 'ies'}.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No companies match.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>Name</th>
							<th>Roles</th>
							<th>Location</th>
							<th>Quote email(s)</th>
							<th>Order email(s)</th>
							<th>QBO links</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((c) => {
							const cityState = [c.city, c.state].filter(Boolean).join(', ');
							const roles = (c.roles ?? '').split(',').filter(Boolean);
							return (
								<tr key={c.id}>
									<td>
										<a href={`/companies/${c.id}`}>{c.name}</a>
									</td>
									<td>
										{roles.map((r) => (
											<RoleBadge key={r} role={r} />
										))}
									</td>
									<td className="muted">{cityState || '—'}</td>
									<td className="muted" style={{ fontSize: '11px' }}>
										{c.quoteEmails ?? '—'}
									</td>
									<td className="muted" style={{ fontSize: '11px' }}>
										{c.orderEmails ?? '—'}
									</td>
									<td>
										<QboBadges customer={c.qboCustomerId} vendor={c.qboVendorId} />
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

function RoleBadge({ role }: { role: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		manufacturer: { bg: '#eef6ff', fg: '#234' },
		rep_firm: { bg: '#fff3e0', fg: '#7a4500' },
		client: { bg: '#d4edda', fg: '#155724' },
		gc: { bg: '#f5d6d6', fg: '#7a1212' },
		designer: { bg: '#fce4ec', fg: '#7a1245' }
	};
	const c = colors[role] ?? { bg: '#eee', fg: '#333' };
	const labels: Record<string, string> = {
		manufacturer: 'MFR',
		rep_firm: 'REP',
		client: 'CLIENT',
		gc: 'GC',
		designer: 'DESIGNER'
	};
	return (
		<span
			style={{
				background: c.bg,
				color: c.fg,
				padding: '1px 5px',
				marginRight: '3px',
				borderRadius: '3px',
				fontSize: '10px',
				fontWeight: 600
			}}
		>
			{labels[role] ?? role}
		</span>
	);
}

function QboBadges({
	customer,
	vendor
}: {
	customer: string | null;
	vendor: string | null;
}) {
	if (!customer && !vendor) {
		return <span className="muted" style={{ fontSize: '11px' }}>—</span>;
	}
	return (
		<span style={{ fontSize: '11px' }}>
			{customer && <span style={{ color: '#0a7c2f', marginRight: '4px' }}>● C</span>}
			{vendor && <span style={{ color: '#0a3a6e' }}>● V</span>}
		</span>
	);
}
