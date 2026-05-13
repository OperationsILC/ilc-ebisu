'use client';

import { useActionState, useMemo, useState } from 'react';
import { createRfq, type CreateRfqState } from './actions';

type RepFirm = { id: string; name: string };
type Line = {
	id: string;
	qapIdText: string | null;
	type: string;
	catalogNo: string;
	manufacturer: string | null;
	qty: string | null;
	currentDn: string | null;
	description: string | null;
};

export default function RfqComposer({
	projectId,
	repFirms,
	lines
}: {
	projectId: string;
	repFirms: RepFirm[];
	lines: Line[];
}) {
	const action = createRfq.bind(null, projectId);
	const [state, formAction, pending] = useActionState<CreateRfqState | undefined, FormData>(
		action,
		undefined
	);

	const [selected, setSelected] = useState<Set<string>>(
		new Set(state?.values?.selectedIds ?? [])
	);
	const [filter, setFilter] = useState('');

	// Group lines by manufacturer for visual chunking
	const grouped = useMemo(() => {
		const lower = filter.trim().toLowerCase();
		const map = new Map<string, Line[]>();
		for (const l of lines) {
			if (lower) {
				const haystack = [l.type, l.catalogNo, l.manufacturer ?? '', l.description ?? '']
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(lower)) continue;
			}
			const key = l.manufacturer ?? '(unknown)';
			const arr = map.get(key) ?? [];
			arr.push(l);
			map.set(key, arr);
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [lines, filter]);

	function toggleLine(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelected(next);
	}

	function toggleAllVisible(check: boolean) {
		const next = new Set(selected);
		for (const [, group] of grouped) {
			for (const l of group) {
				if (check) next.add(l.id);
				else next.delete(l.id);
			}
		}
		setSelected(next);
	}

	function toggleGroup(group: Line[], check: boolean) {
		const next = new Set(selected);
		for (const l of group) {
			if (check) next.add(l.id);
			else next.delete(l.id);
		}
		setSelected(next);
	}

	const visibleCount = grouped.reduce((acc, [, g]) => acc + g.length, 0);

	return (
		<form action={formAction}>
			<div style={{ display: 'grid', gap: '12px', maxWidth: '900px', marginBottom: '16px' }}>
				<label>
					Rep firm to send to *
					<br />
					<select name="repFirmCompanyId" defaultValue={state?.values?.repFirmCompanyId ?? ''} required>
						<option value="" disabled>
							— pick a rep firm —
						</option>
						{repFirms.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name}
							</option>
						))}
					</select>
					{state?.errors?.repFirmCompanyId && (
						<span className="flash error" style={{ marginLeft: '8px' }}>
							{state.errors.repFirmCompanyId[0]}
						</span>
					)}
				</label>

				<label>
					Notes (optional)
					<br />
					<textarea
						name="notes"
						rows={2}
						style={{ width: '100%' }}
						defaultValue={state?.values?.notes ?? ''}
						placeholder="Any special instructions or context for the rep…"
					/>
				</label>
			</div>

			<div
				style={{
					display: 'flex',
					gap: '12px',
					alignItems: 'center',
					margin: '12px 0',
					flexWrap: 'wrap'
				}}
			>
				<button
					className="primary"
					type="submit"
					disabled={pending || selected.size === 0}
				>
					{pending ? 'Creating…' : `Create RFQ (${selected.size} line${selected.size === 1 ? '' : 's'})`}
				</button>
				<span className="dirty-badge">{selected.size} selected</span>
				<input
					type="text"
					placeholder="Filter by TYPE, CATALOG, mfr, description…"
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					style={{ minWidth: '260px' }}
				/>
				<button type="button" onClick={() => toggleAllVisible(true)} disabled={visibleCount === 0}>
					Select all visible
				</button>
				<button type="button" onClick={() => toggleAllVisible(false)} disabled={selected.size === 0}>
					Clear selection
				</button>
			</div>

			{state?.error && <p className="flash error">{state.error}</p>}
			{state?.errors?.qapLineIds && (
				<p className="flash error">{state.errors.qapLineIds[0]}</p>
			)}

			{selected.size > 0 &&
				// Hidden inputs that submit the selected line ids to the action.
				Array.from(selected).map((id) => (
					<input key={id} type="hidden" name="qapLineId" value={id} />
				))}

			{grouped.length === 0 ? (
				<p className="muted">No lines match the filter.</p>
			) : (
				grouped.map(([mfr, group]) => {
					const allSelected = group.every((l) => selected.has(l.id));
					return (
						<div key={mfr} style={{ marginBottom: '20px' }}>
							<h3
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									margin: '0 0 4px 0'
								}}
							>
								<label
									style={{
										display: 'flex',
										gap: '6px',
										alignItems: 'center',
										fontWeight: 600
									}}
								>
									<input
										type="checkbox"
										checked={allSelected}
										onChange={(e) => toggleGroup(group, e.target.checked)}
									/>
									{mfr}
								</label>
								<span className="muted" style={{ fontWeight: 400 }}>
									({group.length} line{group.length === 1 ? '' : 's'})
								</span>
							</h3>
							<table className="plain" style={{ fontSize: '12px' }}>
								<thead>
									<tr>
										<th style={{ width: '32px' }}></th>
										<th>TYPE</th>
										<th>CATALOG #</th>
										<th style={{ textAlign: 'right' }}>QTY</th>
										<th style={{ textAlign: 'right' }}>CURRENT DN</th>
										<th>Description</th>
									</tr>
								</thead>
								<tbody>
									{group.map((l) => (
										<tr key={l.id} style={selected.has(l.id) ? { background: '#fff3cd' } : undefined}>
											<td>
												<input
													type="checkbox"
													checked={selected.has(l.id)}
													onChange={() => toggleLine(l.id)}
												/>
											</td>
											<td>{l.type}</td>
											<td>{l.catalogNo}</td>
											<td style={{ textAlign: 'right' }}>{l.qty ?? '—'}</td>
											<td style={{ textAlign: 'right' }}>{l.currentDn ?? '—'}</td>
											<td className="muted" style={{ maxWidth: '320px' }}>
												{l.description ?? ''}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					);
				})
			)}
		</form>
	);
}
