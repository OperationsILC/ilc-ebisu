'use client';

import { useMemo, useState, useTransition } from 'react';
import {
	updateBudgetHeader,
	addQapLinesToBudget,
	saveBudgetLineEdits,
	deleteBudgetLine,
	refreshBudgetFromQap,
	setBudgetStatus,
	cloneBudget
} from '../actions';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

type Budget = {
	id: string;
	budgetNo: string;
	status: string;
	description: string | null;
	marginPct: string | null;
	freightPct: string | null;
	warehousingPct: string | null;
	salesTaxPct: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
};

type Line = {
	id: string;
	qapLineId: string | null;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qtySnapshot: string | null;
	currentDnSnapshot: string | null;
	marginPctSnapshot: string | null;
	qty: string | null;
	unitDn: string | null;
};

type QapOption = {
	id: string;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	currentDn: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	projectTotalSf: number | null;
	projectTargetBudget: string | null;
	projectTargetDollarsPerSf: string | null;
	budget: Budget;
	lines: Line[];
	availableQapLines: QapOption[];
};

export default function BudgetDetailClient({
	projectId,
	projectName,
	projectTotalSf,
	projectTargetBudget,
	projectTargetDollarsPerSf,
	budget,
	lines,
	availableQapLines
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isDraft = budget.status === 'draft';

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	// Per-line dirty edits
	const [qtyEdits, setQtyEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.qty ?? '']))
	);
	const [dnEdits, setDnEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.unitDn ?? '']))
	);

	function isLineDirty(l: Line) {
		return (
			(qtyEdits[l.id] ?? '') !== (l.qty ?? '') ||
			(dnEdits[l.id] ?? '') !== (l.unitDn ?? '')
		);
	}

	const dirtyCount = useMemo(
		() => lines.filter(isLineDirty).length,
		[lines, qtyEdits, dnEdits]
	);

	const margin = Number(budget.marginPct ?? 0);

	// Compute live totals from the editable values
	const totals = useMemo(() => {
		let dn = 0;
		let qty = 0;
		for (const l of lines) {
			const q = Number(qtyEdits[l.id] ?? l.qty ?? 0);
			const d = Number(dnEdits[l.id] ?? l.unitDn ?? 0);
			qty += q;
			dn += q * d;
		}
		const cn = dn * (1 + margin / 100);
		const profit = cn - dn;
		const totalSf = Number(projectTotalSf ?? 0);
		const dollarsPerSf = totalSf > 0 ? cn / totalSf : 0;
		const targetBudget = Number(projectTargetBudget ?? 0);
		const vsTarget = targetBudget > 0 ? cn - targetBudget : null;
		return { qty, dn, cn, profit, dollarsPerSf, vsTarget, totalSf, targetBudget };
	}, [lines, qtyEdits, dnEdits, margin, projectTotalSf, projectTargetBudget]);

	function onSaveLines() {
		const changes: { id: string; qty?: string; unitDn?: string }[] = [];
		for (const l of lines) {
			if (!isLineDirty(l)) continue;
			const fields: { id: string; qty?: string; unitDn?: string } = { id: l.id };
			if ((qtyEdits[l.id] ?? '') !== (l.qty ?? '')) fields.qty = qtyEdits[l.id] ?? '';
			if ((dnEdits[l.id] ?? '') !== (l.unitDn ?? '')) fields.unitDn = dnEdits[l.id] ?? '';
			changes.push(fields);
		}
		if (changes.length === 0) {
			flashThen('Nothing to save.');
			return;
		}
		startTransition(async () => {
			const r = await saveBudgetLineEdits(budget.id, JSON.stringify({ changes }));
			if (r?.error) errorThen(r.error);
			else {
				flashThen(`Saved ${r.saved} line${r.saved === 1 ? '' : 's'}.`);
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onDeleteLine(lineId: string) {
		if (!confirm('Remove this line from the budget?')) return;
		startTransition(async () => {
			const r = await deleteBudgetLine(projectId, budget.id, lineId);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Removed.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onRefreshFromQap() {
		if (
			!confirm(
				'Pull current QAP values into this budget? This overwrites the per-line qty and unit DN with current QAP values for every line.'
			)
		)
			return;
		startTransition(async () => {
			const r = await refreshBudgetFromQap(projectId, budget.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen(`Refreshed ${r.refreshed} line${r.refreshed === 1 ? '' : 's'}.`);
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onSetStatus(newStatus: string) {
		startTransition(async () => {
			const r = await setBudgetStatus(projectId, budget.id, newStatus);
			if (r.error) errorThen(r.error);
			else {
				flashThen(`Status: ${newStatus}.`);
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onClone() {
		if (!confirm('Create a draft copy of this budget?')) return;
		startTransition(async () => {
			await cloneBudget(projectId, budget.id);
		});
	}

	// Add-from-QAP picker
	const [addQuery, setAddQuery] = useState('');
	const [selectedQap, setSelectedQap] = useState<Set<string>>(new Set());

	const filteredQap = useMemo(() => {
		const q = addQuery.trim().toLowerCase();
		if (q === '') return availableQapLines;
		return availableQapLines.filter(
			(l) =>
				(l.type ?? '').toLowerCase().includes(q) ||
				(l.catalogNo ?? '').toLowerCase().includes(q) ||
				(l.manufacturer ?? '').toLowerCase().includes(q) ||
				(l.description ?? '').toLowerCase().includes(q)
		);
	}, [addQuery, availableQapLines]);

	function onAddFromQap() {
		if (selectedQap.size === 0) {
			errorThen('Pick at least one line.');
			return;
		}
		startTransition(async () => {
			const r = await addQapLinesToBudget(projectId, budget.id, Array.from(selectedQap));
			if (r?.error) errorThen(r.error);
			else {
				flashThen(`Added ${r.added}, skipped ${r.skipped ?? 0}.`);
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	const headerAction = updateBudgetHeader.bind(null, projectId, budget.id);

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/budgets`}>← Budgets for {projectName}</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>{budget.budgetNo}</h1>
				<a
					href={`/projects/${projectId}/budgets/${budget.id}/pdf`}
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px' }}
				>
					Download PDF ↗
				</a>
			</div>
			<p className="muted">
				<StatusBadge status={budget.status} /> · {projectName}
				{budget.description && <> · {budget.description}</>}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			{/* === TOTALS === */}
			<h2 style={{ marginBottom: 4 }}>Totals</h2>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
					gap: '8px',
					maxWidth: '1100px',
					marginBottom: '16px'
				}}
			>
				<Stat label="Lines" value={lines.length.toString()} />
				<Stat label="Total QTY" value={totals.qty.toLocaleString()} />
				<Stat label="DN total" value={usd.format(totals.dn)} />
				<Stat
					label={`CN total (${margin}% margin)`}
					value={usd.format(totals.cn)}
					highlight
				/>
				<Stat
					label="Profit"
					value={usd.format(totals.profit)}
					muted={totals.profit === 0}
					positive={totals.profit > 0}
				/>
				{totals.totalSf > 0 && (
					<Stat label="$/SF" value={usd.format(totals.dollarsPerSf)} />
				)}
				{totals.vsTarget !== null && (
					<Stat
						label="vs target"
						value={`${totals.vsTarget > 0 ? '+' : ''}${usd.format(totals.vsTarget)}`}
						positive={totals.vsTarget < 0}
						negative={totals.vsTarget > 0}
					/>
				)}
			</div>

			{(projectTotalSf || projectTargetBudget || projectTargetDollarsPerSf) && (
				<p className="muted" style={{ fontSize: '11px', marginTop: -8 }}>
					Project target: budget {projectTargetBudget ? usd.format(Number(projectTargetBudget)) : '—'} ·
					{' '}target $/SF {projectTargetDollarsPerSf ? usd.format(Number(projectTargetDollarsPerSf)) : '—'} ·
					{' '}total SF {projectTotalSf ? projectTotalSf.toLocaleString() : '—'}
				</p>
			)}

			{/* === ACTIONS === */}
			<div style={{ display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' }}>
				{isDraft && (
					<>
						<button onClick={() => onSetStatus('sent')} disabled={pending}>
							Mark sent
						</button>
						<button onClick={onRefreshFromQap} disabled={pending}>
							Refresh from QAP
						</button>
					</>
				)}
				{budget.status === 'sent' && (
					<button onClick={() => onSetStatus('confirmed')} disabled={pending}>
						Mark confirmed
					</button>
				)}
				{['draft', 'sent'].includes(budget.status) && (
					<button onClick={() => onSetStatus('archived')} disabled={pending}>
						Archive
					</button>
				)}
				<button onClick={onClone} disabled={pending} style={{ marginLeft: 'auto' }}>
					Clone as new draft
				</button>
			</div>

			{/* === LINES === */}
			<h2>
				Lines ({lines.length})
				{isDraft && dirtyCount > 0 && (
					<>
						{' '}
						<button
							className="primary"
							onClick={onSaveLines}
							disabled={pending}
							style={{ fontSize: '13px', marginLeft: '12px' }}
						>
							{pending ? 'Saving…' : `Save (${dirtyCount} row${dirtyCount === 1 ? '' : 's'} edited)`}
						</button>
					</>
				)}
			</h2>

			{lines.length === 0 ? (
				<p className="muted">No lines. Add some from the QAP below.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px', maxWidth: '1300px' }}>
					<thead>
						<tr>
							<th>Type</th>
							<th>Catalog #</th>
							<th>Manufacturer</th>
							<th className="muted">Description</th>
							<th style={{ textAlign: 'right' }}>QAP qty</th>
							<th style={{ textAlign: 'right' }}>Budget qty</th>
							<th style={{ textAlign: 'right' }}>QAP DN</th>
							<th style={{ textAlign: 'right' }}>Budget unit DN</th>
							<th style={{ textAlign: 'right' }}>Line DN</th>
							<th style={{ textAlign: 'right' }}>Line CN</th>
							{isDraft && <th></th>}
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => {
							const q = Number(qtyEdits[l.id] ?? l.qty ?? 0);
							const d = Number(dnEdits[l.id] ?? l.unitDn ?? 0);
							const lineDn = q * d;
							const lineCn = lineDn * (1 + margin / 100);
							const dirty = isLineDirty(l);
							const bg = dirty ? { background: '#fff3cd' } : undefined;
							return (
								<tr key={l.id} style={bg}>
									<td>{l.type ?? '—'}</td>
									<td>{l.catalogNo ?? '—'}</td>
									<td>{l.manufacturer ?? '—'}</td>
									<td className="muted">{l.description ?? '—'}</td>
									<td style={{ textAlign: 'right' }} className="muted">
										{l.qtySnapshot ? Number(l.qtySnapshot).toLocaleString() : '—'}
									</td>
									<td style={{ textAlign: 'right' }}>
										<input
											type="number"
											step="0.01"
											value={qtyEdits[l.id] ?? ''}
											onChange={(e) => setQtyEdits({ ...qtyEdits, [l.id]: e.target.value })}
											disabled={!isDraft || pending}
											style={{ width: '70px', textAlign: 'right' }}
										/>
									</td>
									<td style={{ textAlign: 'right' }} className="muted">
										{l.currentDnSnapshot ? usd.format(Number(l.currentDnSnapshot)) : '—'}
									</td>
									<td style={{ textAlign: 'right' }}>
										<input
											type="number"
											step="0.01"
											value={dnEdits[l.id] ?? ''}
											onChange={(e) => setDnEdits({ ...dnEdits, [l.id]: e.target.value })}
											disabled={!isDraft || pending}
											style={{ width: '90px', textAlign: 'right' }}
										/>
									</td>
									<td style={{ textAlign: 'right' }}>{usd.format(lineDn)}</td>
									<td style={{ textAlign: 'right' }}>{usd.format(lineCn)}</td>
									{isDraft && (
										<td>
											<button
												onClick={() => onDeleteLine(l.id)}
												disabled={pending}
												style={{ fontSize: '11px' }}
											>
												×
											</button>
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			)}

			{/* === ADD FROM QAP === */}
			{isDraft && (
				<>
					<h2 style={{ marginTop: '32px' }}>Add lines from QAP</h2>
					<p className="muted" style={{ fontSize: '12px' }}>
						QAP lines NOT already on this budget. Search across type, catalog #, manufacturer,
						description.
					</p>
					<div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
						<input
							type="text"
							value={addQuery}
							onChange={(e) => setAddQuery(e.target.value)}
							placeholder="Search…"
							style={{ width: '300px' }}
						/>
						<span className="muted">
							{filteredQap.length} of {availableQapLines.length} match
							{selectedQap.size > 0 && ` · ${selectedQap.size} selected`}
						</span>
						<button
							className="primary"
							onClick={onAddFromQap}
							disabled={pending || selectedQap.size === 0}
							style={{ marginLeft: 'auto' }}
						>
							Add selected to budget
						</button>
					</div>
					{filteredQap.length === 0 ? (
						<p className="muted">No QAP lines match.</p>
					) : (
						<table
							className="plain"
							style={{ fontSize: '12px', maxHeight: '400px', overflowY: 'auto', display: 'block' }}
						>
							<thead>
								<tr>
									<th></th>
									<th>Type</th>
									<th>Catalog #</th>
									<th>Manufacturer</th>
									<th className="muted">Description</th>
									<th style={{ textAlign: 'right' }}>QTY</th>
									<th style={{ textAlign: 'right' }}>Current DN</th>
								</tr>
							</thead>
							<tbody>
								{filteredQap.slice(0, 100).map((q) => (
									<tr key={q.id}>
										<td>
											<input
												type="checkbox"
												checked={selectedQap.has(q.id)}
												onChange={(e) => {
													const next = new Set(selectedQap);
													if (e.target.checked) next.add(q.id);
													else next.delete(q.id);
													setSelectedQap(next);
												}}
												disabled={pending}
											/>
										</td>
										<td>{q.type ?? '—'}</td>
										<td>{q.catalogNo ?? '—'}</td>
										<td>{q.manufacturer ?? '—'}</td>
										<td className="muted">{q.description ?? '—'}</td>
										<td style={{ textAlign: 'right' }}>
											{q.qty ? Number(q.qty).toLocaleString() : '—'}
										</td>
										<td style={{ textAlign: 'right' }}>
											{q.currentDn ? usd.format(Number(q.currentDn)) : '—'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
					{filteredQap.length > 100 && (
						<p className="muted" style={{ fontSize: '11px' }}>
							Showing first 100 — refine the search to see more.
						</p>
					)}
				</>
			)}

			{/* === HEADER FORM === */}
			<h2 style={{ marginTop: '32px' }}>Budget details</h2>
			<form action={headerAction} style={{ maxWidth: '900px' }}>
				<label style={{ display: 'block' }}>
					Description (label that appears on the list page)
					<input
						name="description"
						type="text"
						defaultValue={budget.description ?? ''}
						placeholder="e.g. FINAL UPDATE, SUBMITTAL & RFI UPDATES, GMP SET, PERMIT SET"
						disabled={!isDraft}
						style={{ width: '100%' }}
					/>
				</label>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
					<label>
						Margin %
						<input
							name="marginPct"
							type="number"
							step="0.01"
							defaultValue={budget.marginPct ?? ''}
							disabled={!isDraft}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Freight %
						<input
							name="freightPct"
							type="number"
							step="0.01"
							defaultValue={budget.freightPct ?? ''}
							disabled={!isDraft}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Warehousing %
						<input
							name="warehousingPct"
							type="number"
							step="0.01"
							defaultValue={budget.warehousingPct ?? ''}
							disabled={!isDraft}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Sales tax %
						<input
							name="salesTaxPct"
							type="number"
							step="0.001"
							defaultValue={budget.salesTaxPct ?? ''}
							disabled={!isDraft}
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Notes
					<textarea
						name="notes"
						rows={3}
						defaultValue={budget.notes ?? ''}
						disabled={!isDraft}
						style={{ width: '100%' }}
					/>
				</label>
				{isDraft && (
					<div style={{ marginTop: '12px' }}>
						<button className="primary" type="submit">
							Save details
						</button>
					</div>
				)}
			</form>
		</>
	);
}

function Stat({
	label,
	value,
	highlight,
	muted,
	positive,
	negative
}: {
	label: string;
	value: string;
	highlight?: boolean;
	muted?: boolean;
	positive?: boolean;
	negative?: boolean;
}) {
	let color = '#111';
	if (muted) color = '#999';
	else if (negative) color = '#7a1212';
	else if (positive) color = '#0a7c2f';
	return (
		<div
			style={{
				padding: '8px 10px',
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '16px', fontWeight: 600, color: highlight ? '#0a7c2f' : color }}>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		confirmed: { bg: '#d4edda', fg: '#155724' },
		archived: { bg: '#eee', fg: '#666' }
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
