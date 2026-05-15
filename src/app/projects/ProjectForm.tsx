'use client';

import { useActionState } from 'react';
import { createProject, updateProject, type ProjectFormState } from './form-actions';

type UserOpt = { id: string; name: string | null; email: string };
type CompanyOpt = { id: string; name: string };

export type ProjectFormProps = {
	mode: 'create' | 'edit';
	project?: {
		id: string;
		name: string;
		status: string;
		phase: string | null;
		projectType: string | null;
		serviceType: string | null;
		clientCompanyId: string | null;
		gcCompanyId: string | null;
		designerCompanyId: string | null;
		projectManagerUserId: string | null;
		designLeadUserId: string | null;
		secondDesignerUserId: string | null;
		salesPersonUserId: string | null;
		caManagerUserId: string | null;
		ifcSubDate: string | null;
		expectedOrderDate: string | null;
		designStartDate: string | null;
		roughInStartDate: string | null;
		constructionStartDate: string | null;
		marginPct: string | null;
		freightPct: string | null;
		warehousingPct: string | null;
		salesTaxPct: string | null;
		salesTaxName: string | null;
		projectedDesignFeeTotal: string | null;
		targetBudgetTotal: string | null;
		targetDollarsPerSf: string | null;
		emailsForBudgets: string | null;
		emailsForQuotesSo: string | null;
		emailsForShipmentUpdates: string | null;
		deliveryStreet: string | null;
		deliveryCity: string | null;
		deliveryState: string | null;
		deliveryZip: string | null;
		deliverySiteContactName: string | null;
		deliverySiteContactPhone: string | null;
		siteStreet: string | null;
		siteCity: string | null;
		siteState: string | null;
		siteZip: string | null;
		jobSiteContactName: string | null;
		jobSiteContactPhone: string | null;
		totalSf: number | null;
		interiorSf: number | null;
		exteriorSf: number | null;
		numUnitsRooms: number | null;
		unitRoomSf: number | null;
		garageSf: number | null;
		bohSf: number | null;
		openOfficeSf: number | null;
		privateOfficeSf: number | null;
		corridorAreaSf: number | null;
		amenityAreaSf: number | null;
		unfinishedOfficeSf: number | null;
		description: string | null;
		notes: string | null;
		projectStats: string | null;
	};
	users: UserOpt[];
	clientCompanies: CompanyOpt[];
	gcCompanies: CompanyOpt[];
	designerCompanies: CompanyOpt[];
};

const STATUS_OPTIONS = ['active', 'completed', 'test', 'on_hold'];
const PHASE_OPTIONS = ['SD', 'DD', 'CD', 'CA', 'bidding', 'construction', 'closeout'];
const PROJECT_TYPE_OPTIONS = [
	'Hospitality',
	'Multifamily',
	'Office',
	'Retail',
	'Education',
	'Healthcare',
	'Mixed Use',
	'Civic',
	'Other'
];
const SERVICE_TYPE_OPTIONS = [
	'Full Service Design',
	'Design Only',
	'Procurement Only',
	'Owner-Direct',
	'Other'
];

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

function userLabel(u: UserOpt): string {
	return u.name ? `${u.name} (${u.email})` : u.email;
}

export default function ProjectForm({
	mode,
	project,
	users,
	clientCompanies,
	gcCompanies,
	designerCompanies
}: ProjectFormProps) {
	const action =
		mode === 'create' ? createProject : updateProject.bind(null, project!.id);

	const [state, formAction, pending] = useActionState<ProjectFormState | undefined, FormData>(
		action,
		undefined
	);

	const p = project;
	const err = state?.errors ?? {};

	return (
		<form action={formAction} style={{ maxWidth: '1100px' }}>
			{state?.error && <p className="flash error">{state.error}</p>}
			{state?.ok && <p className="flash success">Saved.</p>}

			{/* === IDENTITY === */}
			<h2>Identity</h2>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Name <span style={{ color: '#c00' }}>*</span>
					<input
						name="name"
						type="text"
						defaultValue={p?.name ?? ''}
						required
						disabled={pending}
						style={{ width: '100%' }}
					/>
					{err.name && <span className="flash error">{err.name[0]}</span>}
				</label>
				<label>
					Status
					<select name="status" defaultValue={p?.status ?? 'active'} disabled={pending} style={{ width: '100%' }}>
						{STATUS_OPTIONS.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>
				<label>
					Phase
					<select name="phase" defaultValue={p?.phase ?? ''} disabled={pending} style={{ width: '100%' }}>
						<option value="">—</option>
						{PHASE_OPTIONS.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>
				<label>
					Project type
					<select
						name="projectType"
						defaultValue={p?.projectType ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					>
						<option value="">—</option>
						{PROJECT_TYPE_OPTIONS.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>
			</div>
			<label style={{ display: 'block', marginTop: '12px' }}>
				Service type
				<select
					name="serviceType"
					defaultValue={p?.serviceType ?? ''}
					disabled={pending}
					style={{ width: '300px' }}
				>
					<option value="">—</option>
					{SERVICE_TYPE_OPTIONS.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>

			{/* === STAFF === */}
			<h2 style={{ marginTop: '24px' }}>ILC team</h2>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<label>
					Project manager (PM)
					<UserSelect
						name="projectManagerUserId"
						users={users}
						defaultValue={p?.projectManagerUserId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					Procurement manager (PPM) — same as PM by default
					<UserSelect
						name="procurementMgrUserId"
						users={users}
						defaultValue={p?.projectManagerUserId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					Design lead
					<UserSelect
						name="designLeadUserId"
						users={users}
						defaultValue={p?.designLeadUserId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					Second designer
					<UserSelect
						name="secondDesignerUserId"
						users={users}
						defaultValue={p?.secondDesignerUserId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					Sales person
					<UserSelect
						name="salesPersonUserId"
						users={users}
						defaultValue={p?.salesPersonUserId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					CA manager
					<UserSelect
						name="caManagerUserId"
						users={users}
						defaultValue={p?.caManagerUserId ?? ''}
						disabled={pending}
					/>
				</label>
			</div>

			{/* === CONTACTS (companies) === */}
			<h2 style={{ marginTop: '24px' }}>External companies</h2>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Client
					<CompanySelect
						name="clientCompanyId"
						companies={clientCompanies}
						defaultValue={p?.clientCompanyId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					General contractor
					<CompanySelect
						name="gcCompanyId"
						companies={gcCompanies}
						defaultValue={p?.gcCompanyId ?? ''}
						disabled={pending}
					/>
				</label>
				<label>
					Designer
					<CompanySelect
						name="designerCompanyId"
						companies={designerCompanies}
						defaultValue={p?.designerCompanyId ?? ''}
						disabled={pending}
					/>
				</label>
			</div>
			<p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
				Dropdowns list companies tagged with the matching role. Don&apos;t see a company? Add it
				on the <a href="/companies/new" target="_blank" rel="noopener">Companies page</a> first.
			</p>

			{/* === DATES === */}
			<h2 style={{ marginTop: '24px' }}>Key dates</h2>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
				<label>
					Design start
					<input
						name="designStartDate"
						type="date"
						defaultValue={toDateInput(p?.designStartDate ?? null)}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					IFC sub date
					<input
						name="ifcSubDate"
						type="date"
						defaultValue={toDateInput(p?.ifcSubDate ?? null)}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Expected order date
					<input
						name="expectedOrderDate"
						type="date"
						defaultValue={toDateInput(p?.expectedOrderDate ?? null)}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Rough-in start
					<input
						name="roughInStartDate"
						type="date"
						defaultValue={toDateInput(p?.roughInStartDate ?? null)}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Construction start
					<input
						name="constructionStartDate"
						type="date"
						defaultValue={toDateInput(p?.constructionStartDate ?? null)}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			{/* === FINANCIAL DEFAULTS === */}
			<h2 style={{ marginTop: '24px' }}>Financial defaults</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				Cascaded onto SOs and invoices when they&apos;re created. Each document can override.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Margin %
					<input
						name="marginPct"
						type="number"
						step="0.01"
						defaultValue={p?.marginPct ?? (mode === 'create' ? '23' : '')}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Freight %
					<input
						name="freightPct"
						type="number"
						step="0.01"
						defaultValue={p?.freightPct ?? (mode === 'create' ? '6' : '')}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Warehousing %
					<input
						name="warehousingPct"
						type="number"
						step="0.01"
						defaultValue={p?.warehousingPct ?? (mode === 'create' ? '3' : '')}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Sales tax %
					<input
						name="salesTaxPct"
						type="number"
						step="0.001"
						defaultValue={p?.salesTaxPct ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Sales tax label
					<input
						name="salesTaxName"
						type="text"
						defaultValue={p?.salesTaxName ?? ''}
						placeholder="e.g. 2.9% — CO STATE"
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
				<label>
					Projected design fee total $
					<input
						name="projectedDesignFeeTotal"
						type="number"
						step="0.01"
						defaultValue={p?.projectedDesignFeeTotal ?? ''}
						disabled={pending}
						placeholder="Design-fee revenue forecast"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Target product budget $
					<input
						name="targetBudgetTotal"
						type="number"
						step="0.01"
						defaultValue={p?.targetBudgetTotal ?? ''}
						disabled={pending}
						placeholder="What budgets compare against"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Target $/SF
					<input
						name="targetDollarsPerSf"
						type="number"
						step="0.01"
						defaultValue={p?.targetDollarsPerSf ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			{/* === EMAIL ROUTING === */}
			<h2 style={{ marginTop: '24px' }}>Project-level email overrides</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				If set, these emails win over the company-default emails for this project. Comma-separated.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Emails for budgets
					<input
						name="emailsForBudgets"
						type="text"
						defaultValue={p?.emailsForBudgets ?? ''}
						disabled={pending}
						placeholder="pm@client.com, designer@firm.com"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Emails for quotes / SOs
					<input
						name="emailsForQuotesSo"
						type="text"
						defaultValue={p?.emailsForQuotesSo ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Emails for shipment updates
					<input
						name="emailsForShipmentUpdates"
						type="text"
						defaultValue={p?.emailsForShipmentUpdates ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			{/* === DELIVERY ADDRESS === */}
			<h2 style={{ marginTop: '24px' }}>Delivery address</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				Where ILC ships TO — usually the GC&apos;s warehouse or the jobsite.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1fr', gap: '12px' }}>
				<label>
					Street
					<input name="deliveryStreet" type="text" defaultValue={p?.deliveryStreet ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					City
					<input name="deliveryCity" type="text" defaultValue={p?.deliveryCity ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					State
					<input name="deliveryState" type="text" defaultValue={p?.deliveryState ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					ZIP
					<input name="deliveryZip" type="text" defaultValue={p?.deliveryZip ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr', gap: '12px', marginTop: '12px' }}>
				<label>
					Delivery contact name
					<input
						name="deliverySiteContactName"
						type="text"
						defaultValue={p?.deliverySiteContactName ?? ''}
						disabled={pending}
						placeholder="e.g. LAKEWOOD ELECTRIC: ATTN DON MOLLMAN"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Delivery contact phone
					<input
						name="deliverySiteContactPhone"
						type="text"
						defaultValue={p?.deliverySiteContactPhone ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			{/* === JOB SITE ADDRESS === */}
			<h2 style={{ marginTop: '24px' }}>Job site address</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				The physical building. Drives sales tax jurisdiction. Separate from delivery — they
				often differ.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr 1fr', gap: '12px' }}>
				<label>
					Street
					<input name="siteStreet" type="text" defaultValue={p?.siteStreet ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					City
					<input name="siteCity" type="text" defaultValue={p?.siteCity ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					State
					<input name="siteState" type="text" defaultValue={p?.siteState ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
				<label>
					ZIP
					<input name="siteZip" type="text" defaultValue={p?.siteZip ?? ''} disabled={pending} style={{ width: '100%' }} />
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr', gap: '12px', marginTop: '12px' }}>
				<label>
					Job site contact name
					<input
						name="jobSiteContactName"
						type="text"
						defaultValue={p?.jobSiteContactName ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Job site contact phone
					<input
						name="jobSiteContactPhone"
						type="text"
						defaultValue={p?.jobSiteContactPhone ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			{/* === SQUARE FOOTAGE === */}
			<h2 style={{ marginTop: '24px' }}>Square footage</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				Top-line: Total / Interior / Exterior. Supplemental: per-space-type breakdown — useful
				for budget $/SF analysis.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Total SF
					<input
						name="totalSf"
						type="number"
						defaultValue={p?.totalSf ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Interior SF
					<input
						name="interiorSf"
						type="number"
						defaultValue={p?.interiorSf ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Exterior SF
					<input
						name="exteriorSf"
						type="number"
						defaultValue={p?.exteriorSf ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					# units / rooms
					<input
						name="numUnitsRooms"
						type="number"
						defaultValue={p?.numUnitsRooms ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>
			<details style={{ marginTop: '12px' }}>
				<summary className="muted" style={{ cursor: 'pointer' }}>
					Supplemental SF breakdown (per-space-type)
				</summary>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr 1fr 1fr',
						gap: '12px',
						marginTop: '12px'
					}}
				>
					<label>
						Unit / room SF
						<input name="unitRoomSf" type="number" defaultValue={p?.unitRoomSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Garage SF
						<input name="garageSf" type="number" defaultValue={p?.garageSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						BOH SF
						<input name="bohSf" type="number" defaultValue={p?.bohSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Open office SF
						<input name="openOfficeSf" type="number" defaultValue={p?.openOfficeSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Private office SF
						<input name="privateOfficeSf" type="number" defaultValue={p?.privateOfficeSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Corridor SF
						<input name="corridorAreaSf" type="number" defaultValue={p?.corridorAreaSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Amenity SF
						<input name="amenityAreaSf" type="number" defaultValue={p?.amenityAreaSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
					<label>
						Unfinished office SF
						<input name="unfinishedOfficeSf" type="number" defaultValue={p?.unfinishedOfficeSf ?? ''} disabled={pending} style={{ width: '100%' }} />
					</label>
				</div>
			</details>

			{/* === NOTES === */}
			<h2 style={{ marginTop: '24px' }}>Notes</h2>
			<label style={{ display: 'block' }}>
				Description (visible-ish — used as a subtitle on docs)
				<textarea
					name="description"
					rows={2}
					defaultValue={p?.description ?? ''}
					disabled={pending}
					style={{ width: '100%' }}
				/>
			</label>
			<label style={{ display: 'block', marginTop: '12px' }}>
				Project notes (internal, free-form)
				<textarea
					name="notes"
					rows={4}
					defaultValue={p?.notes ?? ''}
					disabled={pending}
					placeholder="Scoping notes, design decisions, anything the team needs to remember."
					style={{ width: '100%' }}
				/>
			</label>
			<label style={{ display: 'block', marginTop: '12px' }}>
				Project stats (internal — used for tax/permit/jurisdiction notes)
				<textarea
					name="projectStats"
					rows={3}
					defaultValue={p?.projectStats ?? ''}
					disabled={pending}
					placeholder="e.g. Building permit needed for tax rate. PER JAMIE: Routt County and Steamboat collect a USE tax at permit pickup..."
					style={{ width: '100%' }}
				/>
			</label>

			<div style={{ marginTop: '24px' }}>
				<button className="primary" type="submit" disabled={pending}>
					{pending ? 'Saving…' : mode === 'create' ? 'Create project' : 'Save changes'}
				</button>
				<a
					href={mode === 'create' ? '/projects' : `/projects/${project!.id}`}
					style={{ marginLeft: '12px' }}
				>
					Cancel
				</a>
			</div>
		</form>
	);
}

function UserSelect({
	name,
	users,
	defaultValue,
	disabled
}: {
	name: string;
	users: UserOpt[];
	defaultValue: string;
	disabled: boolean;
}) {
	return (
		<select name={name} defaultValue={defaultValue} disabled={disabled} style={{ width: '100%' }}>
			<option value="">—</option>
			{users.map((u) => (
				<option key={u.id} value={u.id}>
					{userLabel(u)}
				</option>
			))}
		</select>
	);
}

function CompanySelect({
	name,
	companies,
	defaultValue,
	disabled
}: {
	name: string;
	companies: CompanyOpt[];
	defaultValue: string;
	disabled: boolean;
}) {
	return (
		<select name={name} defaultValue={defaultValue} disabled={disabled} style={{ width: '100%' }}>
			<option value="">—</option>
			{companies.map((c) => (
				<option key={c.id} value={c.id}>
					{c.name}
				</option>
			))}
		</select>
	);
}
