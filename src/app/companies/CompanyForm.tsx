'use client';

import { useActionState } from 'react';
import { createCompany, updateCompany, type CompanyResult } from './actions';

type ParentOption = { id: string; name: string };

type CompanyFormProps = {
	mode: 'create' | 'edit';
	company?: {
		id: string;
		name: string;
		street: string | null;
		city: string | null;
		state: string | null;
		zip: string | null;
		phone: string | null;
		website: string | null;
		quoteEmails: string | null;
		orderEmails: string | null;
		paymentTermsDays: number | null;
		ffa: string | null;
		creditLimit: string | null;
		parentCompanyId: string | null;
		notes: string | null;
		qboCustomerId: string | null;
		qboVendorId: string | null;
	};
	currentRoles?: string[];
	parentOptions: ParentOption[];
};

export default function CompanyForm({
	mode,
	company,
	currentRoles = [],
	parentOptions
}: CompanyFormProps) {
	const action =
		mode === 'create' ? createCompany : updateCompany.bind(null, company!.id);

	const [state, formAction, pending] = useActionState<CompanyResult | undefined, FormData>(
		action,
		undefined
	);

	const c = company;
	const hasRole = (r: string) => currentRoles.includes(r);

	return (
		<form action={formAction} style={{ maxWidth: '900px' }}>
			{state?.error && <p className="flash error">{state.error}</p>}
			{state?.ok && <p className="flash success">Saved.</p>}

			<h2>Identity</h2>
			<label>
				Name <span style={{ color: '#c00' }}>*</span>
				<br />
				<input
					name="name"
					type="text"
					defaultValue={c?.name ?? ''}
					required
					disabled={pending}
					style={{ width: '100%' }}
					placeholder="e.g. LOGIQ SUPPLY  (case-sensitive — match QBO exactly)"
				/>
			</label>

			<h2 style={{ marginTop: '24px' }}>Roles</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				A company can hold multiple roles. Tick all that apply.
			</p>
			<div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
				<label>
					<input type="checkbox" name="role_manufacturer" defaultChecked={hasRole('manufacturer')} disabled={pending} /> Manufacturer
				</label>
				<label>
					<input type="checkbox" name="role_rep_firm" defaultChecked={hasRole('rep_firm')} disabled={pending} /> Rep firm
				</label>
				<label>
					<input type="checkbox" name="role_client" defaultChecked={hasRole('client')} disabled={pending} /> Client
				</label>
				<label>
					<input type="checkbox" name="role_gc" defaultChecked={hasRole('gc')} disabled={pending} /> General contractor
				</label>
				<label>
					<input type="checkbox" name="role_designer" defaultChecked={hasRole('designer')} disabled={pending} /> Designer
				</label>
			</div>

			<h2 style={{ marginTop: '24px' }}>QBO mapping</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				QBO IDs are required before the first push of any invoice (Customer ID) or bill (Vendor
				ID) involving this company. Same company can be both. Leave blank if you don&apos;t know;
				on first push, Ebisu will search QBO by name and store the ID.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<label>
					QBO Customer ID (for AR — receives invoices)
					<input
						name="qboCustomerId"
						type="text"
						defaultValue={c?.qboCustomerId ?? ''}
						disabled={pending}
						placeholder="e.g. 1234"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					QBO Vendor ID (for AP — sends bills)
					<input
						name="qboVendorId"
						type="text"
						defaultValue={c?.qboVendorId ?? ''}
						disabled={pending}
						placeholder="e.g. 5678"
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			<h2 style={{ marginTop: '24px' }}>Email routing</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				Default emails used when sending RFQs (quote_emails) and POs (order_emails). Comma-separated.
				Projects can override these.
			</p>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
				<label>
					Quote email(s)
					<input
						name="quoteEmails"
						type="text"
						defaultValue={c?.quoteEmails ?? ''}
						disabled={pending}
						placeholder="quotes@vendor.com, sales@vendor.com"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Order email(s)
					<input
						name="orderEmails"
						type="text"
						defaultValue={c?.orderEmails ?? ''}
						disabled={pending}
						placeholder="orders@vendor.com"
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			<h2 style={{ marginTop: '24px' }}>Address & contact</h2>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.6fr 0.7fr', gap: '12px' }}>
				<label>
					Street
					<input
						name="street"
						type="text"
						defaultValue={c?.street ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					City
					<input
						name="city"
						type="text"
						defaultValue={c?.city ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					State
					<input
						name="state"
						type="text"
						defaultValue={c?.state ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					ZIP
					<input
						name="zip"
						type="text"
						defaultValue={c?.zip ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
				<label>
					Phone
					<input
						name="phone"
						type="text"
						defaultValue={c?.phone ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Website
					<input
						name="website"
						type="text"
						defaultValue={c?.website ?? ''}
						disabled={pending}
						placeholder="https://"
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			<h2 style={{ marginTop: '24px' }}>Commercial terms</h2>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Payment terms (days)
					<input
						name="paymentTermsDays"
						type="number"
						defaultValue={c?.paymentTermsDays ?? ''}
						disabled={pending}
						placeholder="e.g. 30"
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					FFA (free freight allowance)
					<input
						name="ffa"
						type="number"
						step="0.01"
						defaultValue={c?.ffa ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Credit limit
					<input
						name="creditLimit"
						type="number"
						step="0.01"
						defaultValue={c?.creditLimit ?? ''}
						disabled={pending}
						style={{ width: '100%' }}
					/>
				</label>
			</div>

			<h2 style={{ marginTop: '24px' }}>Hierarchy</h2>
			<label>
				Parent company (if this is a subsidiary)
				<select
					name="parentCompanyId"
					defaultValue={c?.parentCompanyId ?? ''}
					disabled={pending}
					style={{ width: '100%', maxWidth: '500px' }}
				>
					<option value="">— No parent —</option>
					{parentOptions
						.filter((p) => p.id !== c?.id)
						.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
				</select>
			</label>

			<h2 style={{ marginTop: '24px' }}>Notes</h2>
			<label>
				Internal notes (never sent externally)
				<textarea
					name="notes"
					rows={3}
					defaultValue={c?.notes ?? ''}
					disabled={pending}
					style={{ width: '100%' }}
				/>
			</label>

			<div style={{ marginTop: '24px' }}>
				<button className="primary" type="submit" disabled={pending}>
					{pending ? 'Saving…' : mode === 'create' ? 'Create company' : 'Save changes'}
				</button>
			</div>
		</form>
	);
}
