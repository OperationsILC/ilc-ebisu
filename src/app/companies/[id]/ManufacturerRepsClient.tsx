'use client';

import { useState, useTransition } from 'react';
import { setManufacturerReps } from '../actions';

type Props = {
	manufacturerCompanyId: string;
	repFirms: { id: string; name: string }[];
	linkedRepFirmIds: string[];
};

export default function ManufacturerRepsClient({
	manufacturerCompanyId,
	repFirms,
	linkedRepFirmIds
}: Props) {
	const [selected, setSelected] = useState<Set<string>>(new Set(linkedRepFirmIds));
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function toggle(repFirmId: string) {
		const next = new Set(selected);
		if (next.has(repFirmId)) next.delete(repFirmId);
		else next.add(repFirmId);
		setSelected(next);
	}

	function dirty() {
		if (selected.size !== linkedRepFirmIds.length) return true;
		for (const id of selected) if (!linkedRepFirmIds.includes(id)) return true;
		return false;
	}

	function onSave() {
		startTransition(async () => {
			const r = await setManufacturerReps(manufacturerCompanyId, Array.from(selected));
			if (r.error) {
				setError(r.error);
				setFlash(null);
			} else {
				setFlash(`Saved ${selected.size} rep firm link${selected.size === 1 ? '' : 's'}.`);
				setError(null);
				setTimeout(() => setFlash(null), 4000);
			}
		});
	}

	if (repFirms.length === 0) {
		return (
			<p className="muted">
				No rep firms in the system yet. Create a company with role <strong>Rep firm</strong>{' '}
				first.
			</p>
		);
	}

	return (
		<>
			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
					gap: '6px',
					maxHeight: '300px',
					overflowY: 'auto',
					border: '1px solid #ddd',
					padding: '8px',
					borderRadius: '4px'
				}}
			>
				{repFirms.map((r) => (
					<label key={r.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
						<input
							type="checkbox"
							checked={selected.has(r.id)}
							onChange={() => toggle(r.id)}
							disabled={pending}
						/>
						{r.name}
					</label>
				))}
			</div>
			<div style={{ marginTop: '12px' }}>
				<button className="primary" onClick={onSave} disabled={pending || !dirty()}>
					{pending ? 'Saving…' : `Save (${selected.size} selected)`}
				</button>
			</div>
		</>
	);
}
