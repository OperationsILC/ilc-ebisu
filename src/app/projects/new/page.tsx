'use client';

import { useActionState } from 'react';
import { createProject, type NewProjectState } from './actions';

export default function NewProjectPage() {
	const [state, action, pending] = useActionState<NewProjectState | undefined, FormData>(
		createProject,
		undefined
	);
	const v = state?.values ?? {};
	const err = state?.errors ?? {};

	return (
		<>
			<h1>New project</h1>

			<p>
				<a href="/projects">← back to projects</a>
			</p>

			<form action={action} style={{ maxWidth: '720px', display: 'grid', gap: '12px' }}>
				<label>
					Name *
					<br />
					<input
						name="name"
						type="text"
						defaultValue={v.name ?? ''}
						required
						style={{ width: '100%' }}
					/>
					{err.name && <span className="flash error">{err.name[0]}</span>}
				</label>

				<label>
					Status
					<br />
					<select name="status" defaultValue={v.status ?? 'active'}>
						{['active', 'completed', 'test', 'on_hold'].map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>

				<fieldset>
					<legend>Defaults (percentages)</legend>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
						<label>
							Margin %{' '}
							<input
								name="marginPct"
								type="number"
								step="0.01"
								defaultValue={v.marginPct ?? '23'}
							/>
						</label>
						<label>
							Freight %{' '}
							<input
								name="freightPct"
								type="number"
								step="0.01"
								defaultValue={v.freightPct ?? '6'}
							/>
						</label>
						<label>
							Warehousing %{' '}
							<input
								name="warehousingPct"
								type="number"
								step="0.01"
								defaultValue={v.warehousingPct ?? '3'}
							/>
						</label>
						<label>
							Sales tax %{' '}
							<input
								name="salesTaxPct"
								type="number"
								step="0.01"
								defaultValue={v.salesTaxPct ?? ''}
							/>
						</label>
					</div>
				</fieldset>

				<fieldset>
					<legend>Delivery address</legend>
					<label>
						Street{' '}
						<input
							name="deliveryStreet"
							type="text"
							defaultValue={v.deliveryStreet ?? ''}
							style={{ width: '100%' }}
						/>
					</label>
					<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
						<label>
							City <input name="deliveryCity" type="text" defaultValue={v.deliveryCity ?? ''} />
						</label>
						<label>
							State <input name="deliveryState" type="text" defaultValue={v.deliveryState ?? ''} />
						</label>
						<label>
							ZIP <input name="deliveryZip" type="text" defaultValue={v.deliveryZip ?? ''} />
						</label>
					</div>
				</fieldset>

				<label>
					Description
					<br />
					<textarea
						name="description"
						rows={3}
						style={{ width: '100%' }}
						defaultValue={v.description ?? ''}
					/>
				</label>

				<div>
					<button className="primary" type="submit" disabled={pending}>
						{pending ? 'Creating…' : 'Create project'}
					</button>
					<a href="/projects" style={{ marginLeft: '12px' }}>
						Cancel
					</a>
				</div>
			</form>
		</>
	);
}
