import { db } from '@/lib/db';
import {
	companies,
	companyRoles,
	manufacturerRep,
	projects
} from '@/lib/db/schema';
import { asc, eq, sql, ne } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import CompanyForm from '../CompanyForm';
import ManufacturerRepsClient from './ManufacturerRepsClient';
import QboLinkPanel from './QboLinkPanel';

export default async function EditCompanyPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const company = (await db.select().from(companies).where(eq(companies.id, id)).limit(1))[0];
	if (!company) notFound();

	const roles = await db
		.select({ role: companyRoles.role })
		.from(companyRoles)
		.where(eq(companyRoles.companyId, id));
	const currentRoles = roles.map((r) => r.role);

	const parents = await db
		.select({ id: companies.id, name: companies.name })
		.from(companies)
		.where(ne(companies.id, id))
		.orderBy(asc(companies.name));

	// Usage summary — which projects reference this company in any role.
	const projectUsage = await db
		.select({
			id: projects.id,
			name: projects.name,
			rolesUsed: sql<string>`array_to_string(ARRAY_REMOVE(ARRAY[
				CASE WHEN ${projects.clientCompanyId} = ${id} THEN 'client' END,
				CASE WHEN ${projects.gcCompanyId} = ${id} THEN 'gc' END,
				CASE WHEN ${projects.designerCompanyId} = ${id} THEN 'designer' END
			], NULL), ', ')`
		})
		.from(projects)
		.where(
			sql`${projects.clientCompanyId} = ${id} OR ${projects.gcCompanyId} = ${id} OR ${projects.designerCompanyId} = ${id}`
		)
		.orderBy(asc(projects.name));

	const isManufacturer = currentRoles.includes('manufacturer');

	// For manufacturer companies, surface a rep-firm picker. Load all rep_firm
	// companies and which ones are currently linked to this manufacturer.
	let repFirms: { id: string; name: string }[] = [];
	let linkedRepFirmIds: string[] = [];
	if (isManufacturer) {
		repFirms = await db
			.select({ id: companies.id, name: companies.name })
			.from(companies)
			.innerJoin(
				companyRoles,
				sql`${companyRoles.companyId} = ${companies.id} AND ${companyRoles.role} = 'rep_firm'`
			)
			.orderBy(asc(companies.name));
		const links = await db
			.select({ repFirmId: manufacturerRep.repFirmCompanyId })
			.from(manufacturerRep)
			.where(eq(manufacturerRep.manufacturerCompanyId, id));
		linkedRepFirmIds = links.map((l) => l.repFirmId);
	}

	return (
		<>
			<p>
				<a href="/companies">← Companies</a>
			</p>
			<h1>{company.name}</h1>
			{currentRoles.length > 0 && (
				<p className="muted" style={{ marginTop: '-8px' }}>
					{currentRoles.map((r) => (
						<RoleBadge key={r} role={r} />
					))}
				</p>
			)}

			<CompanyForm
				mode="edit"
				company={{
					id: company.id,
					name: company.name,
					street: company.street,
					city: company.city,
					state: company.state,
					zip: company.zip,
					phone: company.phone,
					website: company.website,
					quoteEmails: company.quoteEmails,
					orderEmails: company.orderEmails,
					paymentTermsDays: company.paymentTermsDays,
					ffa: company.ffa,
					creditLimit: company.creditLimit,
					parentCompanyId: company.parentCompanyId,
					notes: company.notes,
					qboCustomerId: company.qboCustomerId,
					qboVendorId: company.qboVendorId
				}}
				currentRoles={currentRoles}
				parentOptions={parents}
			/>

			<QboLinkPanel
				companyId={id}
				companyName={company.name}
				currentCustomerId={company.qboCustomerId}
				currentVendorId={company.qboVendorId}
			/>

			{isManufacturer && (
				<div style={{ marginTop: '32px', maxWidth: '900px' }}>
					<h2>Rep firms representing this manufacturer</h2>
					<p className="muted" style={{ fontSize: '12px' }}>
						When ILC orders from this manufacturer, POs go to one of these rep firms.
						Defaults to LOGIQ SUPPLY for any manufacturer not mapped here.
					</p>
					<ManufacturerRepsClient
						manufacturerCompanyId={id}
						repFirms={repFirms}
						linkedRepFirmIds={linkedRepFirmIds}
					/>
				</div>
			)}

			{projectUsage.length > 0 && (
				<div style={{ marginTop: '32px', maxWidth: '900px' }}>
					<h2>Used on projects ({projectUsage.length})</h2>
					<ul>
						{projectUsage.map((p) => (
							<li key={p.id}>
								<a href={`/projects/${p.id}`}>{p.name}</a>{' '}
								<span className="muted">— as {p.rolesUsed}</span>
							</li>
						))}
					</ul>
				</div>
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
				marginRight: '4px',
				borderRadius: '3px',
				fontSize: '10px',
				fontWeight: 600
			}}
		>
			{labels[role] ?? role}
		</span>
	);
}
