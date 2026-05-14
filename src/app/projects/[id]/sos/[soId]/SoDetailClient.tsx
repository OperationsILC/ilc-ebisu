'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import {
	updateSoHeader,
	type SoHeaderResult,
	addQapLinesToSo,
	saveOrderLineEdits,
	deleteOrderLine,
	createPosFromSo
} from './actions';
import { createProductInvoice } from '../../invoices/actions';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 2
});
const QTY_TYPE_SUGGESTIONS = ['EA', 'LF', 'FT', 'KIT', 'SET', 'ROLL', 'BOX', 'PCS'];

type So = {
	id: string;
	soNo: string;
	status: string;
	description: string | null;
	notes: string | null;
	customEmailMessage: string | null;
	procurementMgrEmail: string | null;
	marginPct: string | null;
	freightPct: string | null;
	warehousingPct: string | null;
	salesTaxPct: string | null;
	salesTaxName: string | null;
	additionalFreight: string | null;
	freightOverride: string | null;
	sentAt: string | null;
	createdAt: string;
};

type ProjectDefaults = {
	marginPct: string | null;
	freightPct: string | null;
	warehousingPct: string | null;
	salesTaxPct: string | null;
};

type Line = {
	id: string;
	rowVersion: number;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
	unitDn: string | null;
	unitCn: string | null;
	marginPct: string | null;
	repQuoteNo: string | null;
	poNo: string | null;
	purchaseOrderId: string | null;
};

type AvailableLine = {
	id: string;
	type: string;
	catalogNo: string;
	manufacturer: string | null;
	qty: string | null;
	currentDn: string | null;
	description: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	projectDefaults: ProjectDefaults;
	so: So;
	lines: Line[];
	availableLines: AvailableLine[];
	poCount: number;
};

export default function SoDetailClient({
	projectId,
	projectName,
	projectDefaults,
	so,
	lines,
	availableLines,
	poCount
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	// --- Header form state ---
	const headerAction = updateSoHeader.bind(null, projectId, so.id);
	const createInvoiceBound = createProductInvoice.bind(null, projectId, so.id);
	const [headerState, headerFormAction, headerPending] = useActionState<
		SoHeaderResult | undefined,
		FormData
	>(headerAction, undefined);

	// --- Line edits state ---
	const [qtyEdits, setQtyEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.qty ?? '']))
	);
	const [qtyTypeEdits, setQtyTypeEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.qtyType ?? '']))
	);
	const [dnEdits, setDnEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.unitDn ?? '']))
	);
	const [cnEdits, setCnEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.unitCn ?? '']))
	);
	const [marginEdits, setMarginEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.marginPct ?? '']))
	);
	const [repQuoteEdits, setRepQuoteEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.repQuoteNo ?? '']))
	);

	function isLineDirty(l: Line) {
		return (
			(qtyEdits[l.id] ?? '') !== (l.qty ?? '') ||
			(qtyTypeEdits[l.id] ?? '') !== (l.qtyType ?? '') ||
			(dnEdits[l.id] ?? '') !== (l.unitDn ?? '') ||
			(cnEdits[l.id] ?? '') !== (l.unitCn ?? '') ||
			(marginEdits[l.id] ?? '') !== (l.marginPct ?? '') ||
			(repQuoteEdits[l.id] ?? '') !== (l.repQuoteNo ?? '')
		);
	}

	const dirtyCount = useMemo(
		() => lines.filter(isLineDirty).length,
		[lines, qtyEdits, qtyTypeEdits, dnEdits, cnEdits, marginEdits, repQuoteEdits]
	);

	function effective(map: Record<string, string>, l: Line, fallback: string | null): number {
		const v = map[l.id];
		if (v !== undefined && v !== '') return Number(v);
		return Number(fallback ?? 0);
	}

	// Live totals computed against current (dirty) state, falling back to
	// project defaults when SO override is blank.
	const totals = useMemo(() => {
		const marginPct = Number(so.marginPct ?? projectDefaults.marginPct ?? 0);
		const freightPct = Number(so.freightPct ?? projectDefaults.freightPct ?? 0);
		const warehousingPct = Number(so.warehousingPct ?? projectDefaults.warehousingPct ?? 0);
		const salesTaxPct = Number(so.salesTaxPct ?? projectDefaults.salesTaxPct ?? 0);

		let totalQty = 0;
		let totalDn = 0;
		let totalCn = 0;
		for (const l of lines) {
			const qty = effective(qtyEdits, l, l.qty);
			const dn = effective(dnEdits, l, l.unitDn);
			const cn = effective(cnEdits, l, l.unitCn);
			totalQty += qty;
			totalDn += qty * dn;
			totalCn += qty * cn;
		}
		const additionalFreight = Number(so.additionalFreight ?? 0);
		const freightOverride = Number(so.freightOverride ?? 0);
		const freight$ =
			freightOverride > 0 ? freightOverride : totalDn * (freightPct / 100) + additionalFreight;
		const warehousing$ = totalDn * (warehousingPct / 100);
		const tax$ = totalCn * (salesTaxPct / 100);
		const cnSubTotal = totalCn;
		const cnTotal = cnSubTotal + freight$ + warehousing$ + tax$;
		return {
			totalQty,
			totalDn,
			cnSubTotal,
			cnTotal,
			freight$,
			warehousing$,
			tax$,
			marginPct,
			freightPct,
			warehousingPct,
			salesTaxPct
		};
	}, [lines, qtyEdits, dnEdits, cnEdits, so, projectDefaults]);

	function onSaveLineEdits() {
		const changes: { id: string; rowVersion: number; fields: Record<string, string> }[] = [];
		for (const l of lines) {
			if (!isLineDirty(l)) continue;
			const fields: Record<string, string> = {};
			if ((qtyEdits[l.id] ?? '') !== (l.qty ?? '')) fields.qty = qtyEdits[l.id] ?? '';
			if ((qtyTypeEdits[l.id] ?? '') !== (l.qtyType ?? '')) fields.qtyType = qtyTypeEdits[l.id] ?? '';
			if ((dnEdits[l.id] ?? '') !== (l.unitDn ?? '')) fields.unitDn = dnEdits[l.id] ?? '';
			if ((cnEdits[l.id] ?? '') !== (l.unitCn ?? '')) fields.unitCn = cnEdits[l.id] ?? '';
			if ((marginEdits[l.id] ?? '') !== (l.marginPct ?? ''))
				fields.marginPct = marginEdits[l.id] ?? '';
			if ((repQuoteEdits[l.id] ?? '') !== (l.repQuoteNo ?? ''))
				fields.repQuoteNo = repQuoteEdits[l.id] ?? '';
			changes.push({ id: l.id, rowVersion: l.rowVersion, fields });
		}
		if (changes.length === 0) {
			flashThen('Nothing to save.');
			return;
		}
		startTransition(async () => {
			const r = await saveOrderLineEdits(so.id, JSON.stringify({ changes }));
			if (r?.error) errorThen(r.error);
			else {
				let msg = `Saved ${r.accepted.length} line${r.accepted.length === 1 ? '' : 's'}.`;
				if (r.rejected.length > 0) {
					msg += ` ${r.rejected.length} rejected: ${r.rejected.map((x) => x.reason).join('; ')}`;
				}
				flashThen(msg);
			}
		});
	}

	// --- Add-from-QAP state ---
	const [addSelected, setAddSelected] = useState<Set<string>>(new Set());
	const [addFilter, setAddFilter] = useState('');
	const [addOpen, setAddOpen] = useState(false);

	const groupedAvailable = useMemo(() => {
		const lower = addFilter.trim().toLowerCase();
		const map = new Map<string, AvailableLine[]>();
		for (const a of availableLines) {
			if (lower) {
				const haystack = [a.type, a.catalogNo, a.manufacturer ?? '', a.description ?? '']
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(lower)) continue;
			}
			const key = a.manufacturer ?? '(unknown)';
			const arr = map.get(key) ?? [];
			arr.push(a);
			map.set(key, arr);
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [availableLines, addFilter]);

	function onAddLines() {
		if (addSelected.size === 0) {
			flashThen('No lines selected.');
			return;
		}
		startTransition(async () => {
			const r = await addQapLinesToSo(projectId, so.id, Array.from(addSelected));
			if (r?.error) errorThen(r.error);
			else {
				let msg = `Added ${r.added} line${r.added === 1 ? '' : 's'} to SO.`;
				if (r.skipped && r.skipped > 0) msg += ` ${r.skipped} skipped (already on SO).`;
				flashThen(msg);
				setAddSelected(new Set());
				setAddOpen(false);
			}
		});
	}

	function onDelete(orderLineId: string) {
		if (!confirm('Remove this line from the SO?')) return;
		startTransition(async () => {
			const r = await deleteOrderLine(projectId, so.id, orderLineId);
			if (r?.error) errorThen(r.error);
			else flashThen('Line removed.');
		});
	}

	function onCreatePos() {
		if (
			!confirm(
				'Create POs from this SO? Lines will be grouped by manufacturer→rep-firm. Unknown manufacturers default to LOGIQ SUPPLY.'
			)
		)
			return;
		startTransition(async () => {
			const r = await createPosFromSo(projectId, so.id);
			if (r?.error) errorThen(r.error);
			else flashThen(`Created ${r.createdPos} PO${r.createdPos === 1 ? '' : 's'}.`);
		});
	}

	const linesWithoutPo = lines.filter((l) => l.purchaseOrderId === null).length;

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/sos`}>← Sales Orders for {projectName}</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>
					{so.soNo} — {projectName}
				</h1>
				<a
					href={`/projects/${projectId}/sos/${so.id}/pdf`}
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px' }}
				>
					Download PDF ↗
				</a>
			</div>
			<p className="muted">
				<StatusBadge status={so.status} /> · created{' '}
				{new Date(so.createdAt).toLocaleDateString()}
				{so.sentAt && <> · sent {new Date(so.sentAt).toLocaleDateString()}</>}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<datalist id="qty-type-suggestions">
				{QTY_TYPE_SUGGESTIONS.map((s) => (
					<option key={s} value={s} />
				))}
			</datalist>

			{/* === TOTALS PANEL === */}
			<h2>Totals</h2>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
					gap: '8px',
					maxWidth: '1000px',
					marginBottom: '16px'
				}}
			>
				<Stat label="Total QTY" value={totals.totalQty.toLocaleString()} />
				<Stat label="Total DN" value={usd.format(totals.totalDn)} />
				<Stat label="CN Subtotal" value={usd.format(totals.cnSubTotal)} />
				<Stat label="Freight $" value={usd.format(totals.freight$)} />
				<Stat label="Warehousing $" value={usd.format(totals.warehousing$)} />
				<Stat label="Tax $" value={usd.format(totals.tax$)} />
				<Stat label="CN Total" value={usd.format(totals.cnTotal)} highlight />
			</div>

			{/* === CREATE POs ACTION === */}
			<div style={{ margin: '12px 0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
				<button onClick={onCreatePos} disabled={pending || linesWithoutPo === 0}>
					Create POs from SO ({linesWithoutPo} line{linesWithoutPo === 1 ? '' : 's'} not yet on PO)
				</button>
				{poCount > 0 && (
					<a href={`/projects/${projectId}/pos`} className="muted">
						{poCount} PO{poCount === 1 ? '' : 's'} already created — view all
					</a>
				)}
				<form action={createInvoiceBound} style={{ marginLeft: 'auto' }}>
					<button className="primary" type="submit" disabled={pending}>
						+ New invoice from this SO
					</button>
				</form>
			</div>

			{/* === SO LINES === */}
			<h2>Lines ({lines.length})</h2>
			<div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
				<button className="primary" onClick={onSaveLineEdits} disabled={pending || dirtyCount === 0}>
					{pending ? 'Saving…' : `Save changes (${dirtyCount} row${dirtyCount === 1 ? '' : 's'} edited)`}
				</button>
				<span className="muted">Edit any cell, hit Save. Edits sync to the PO automatically.</span>
			</div>

			{lines.length === 0 ? (
				<p className="muted">No lines yet. Use the &quot;Add lines from QAP&quot; panel below.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px' }}>
					<thead>
						<tr>
							<th>TYPE</th>
							<th>CATALOG #</th>
							<th>MANUFACTURER</th>
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th>QTY TYPE</th>
							<th style={{ textAlign: 'right' }}>UNIT DN</th>
							<th style={{ textAlign: 'right' }}>MARGIN %</th>
							<th style={{ textAlign: 'right' }}>UNIT CN</th>
							<th>REP QUOTE #</th>
							<th>PO</th>
							<th style={{ width: '60px' }}></th>
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => {
							const dirty = isLineDirty(l);
							const bg = dirty ? { background: '#fff3cd' } : undefined;
							return (
								<tr key={l.id} style={bg}>
									<td>{l.type}</td>
									<td>{l.catalogNo}</td>
									<td>{l.manufacturer ?? '—'}</td>
									<td style={{ textAlign: 'right' }}>
										<EditNumber
											value={qtyEdits[l.id] ?? ''}
											orig={l.qty ?? ''}
											onChange={(v) => setQtyEdits({ ...qtyEdits, [l.id]: v })}
											pending={pending}
											width="70px"
										/>
									</td>
									<td>
										<EditText
											value={qtyTypeEdits[l.id] ?? ''}
											orig={l.qtyType ?? ''}
											onChange={(v) => setQtyTypeEdits({ ...qtyTypeEdits, [l.id]: v })}
											pending={pending}
											width="70px"
											datalist="qty-type-suggestions"
											upper
										/>
									</td>
									<td style={{ textAlign: 'right' }}>
										<EditNumber
											value={dnEdits[l.id] ?? ''}
											orig={l.unitDn ?? ''}
											onChange={(v) => setDnEdits({ ...dnEdits, [l.id]: v })}
											pending={pending}
											width="90px"
											step="0.01"
										/>
									</td>
									<td style={{ textAlign: 'right' }}>
										<EditNumber
											value={marginEdits[l.id] ?? ''}
											orig={l.marginPct ?? ''}
											onChange={(v) => setMarginEdits({ ...marginEdits, [l.id]: v })}
											pending={pending}
											width="60px"
											step="0.01"
										/>
									</td>
									<td style={{ textAlign: 'right' }}>
										<EditNumber
											value={cnEdits[l.id] ?? ''}
											orig={l.unitCn ?? ''}
											onChange={(v) => setCnEdits({ ...cnEdits, [l.id]: v })}
											pending={pending}
											width="90px"
											step="0.01"
										/>
									</td>
									<td>
										<EditText
											value={repQuoteEdits[l.id] ?? ''}
											orig={l.repQuoteNo ?? ''}
											onChange={(v) => setRepQuoteEdits({ ...repQuoteEdits, [l.id]: v })}
											pending={pending}
											width="100px"
										/>
									</td>
									<td>
										{l.poNo ? (
											<a href={`/projects/${projectId}/pos`}>{l.poNo}</a>
										) : (
											<span className="muted">—</span>
										)}
									</td>
									<td>
										<button onClick={() => onDelete(l.id)} disabled={pending} title="Remove line">
											✕
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}

			{/* === ADD FROM QAP === */}
			<h2 style={{ marginTop: '32px' }}>Add lines from QAP</h2>
			{availableLines.length === 0 ? (
				<p className="muted">Every QAP line on this project is already on this SO.</p>
			) : !addOpen ? (
				<button onClick={() => setAddOpen(true)}>
					Browse {availableLines.length} unused QAP line{availableLines.length === 1 ? '' : 's'}
				</button>
			) : (
				<>
					<div
						style={{
							display: 'flex',
							gap: '12px',
							alignItems: 'center',
							margin: '12px 0',
							flexWrap: 'wrap'
						}}
					>
						<button className="primary" onClick={onAddLines} disabled={pending || addSelected.size === 0}>
							{pending
								? 'Adding…'
								: `Add to SO (${addSelected.size} line${addSelected.size === 1 ? '' : 's'})`}
						</button>
						<button onClick={() => setAddOpen(false)} disabled={pending}>
							Close
						</button>
						<input
							type="text"
							placeholder="Filter…"
							value={addFilter}
							onChange={(e) => setAddFilter(e.target.value)}
							style={{ minWidth: '260px' }}
						/>
						<span className="dirty-badge">{addSelected.size} selected</span>
					</div>
					{groupedAvailable.map(([mfr, group]) => (
						<div key={mfr} style={{ marginBottom: '16px' }}>
							<h4 style={{ margin: '0 0 4px 0' }}>
								{mfr}
								<span className="muted" style={{ fontWeight: 400, marginLeft: '8px' }}>
									({group.length})
								</span>
							</h4>
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
									{group.map((a) => (
										<tr
											key={a.id}
											style={addSelected.has(a.id) ? { background: '#fff3cd' } : undefined}
										>
											<td>
												<input
													type="checkbox"
													checked={addSelected.has(a.id)}
													onChange={() => {
														const next = new Set(addSelected);
														if (next.has(a.id)) next.delete(a.id);
														else next.add(a.id);
														setAddSelected(next);
													}}
												/>
											</td>
											<td>{a.type}</td>
											<td>{a.catalogNo}</td>
											<td style={{ textAlign: 'right' }}>{a.qty ?? '—'}</td>
											<td style={{ textAlign: 'right' }}>{a.currentDn ?? '—'}</td>
											<td className="muted" style={{ maxWidth: '300px' }}>
												{a.description ?? ''}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				</>
			)}

			{/* === HEADER FORM === */}
			<h2 style={{ marginTop: '32px' }}>SO Details</h2>
			<form action={headerFormAction} style={{ maxWidth: '900px' }}>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
					<label>
						Status
						<br />
						<select name="status" defaultValue={so.status}>
							{['draft', 'confirmed', 'shipped', 'invoiced', 'closed', 'cancelled'].map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
					<label>
						Sales tax bucket
						<br />
						<input
							name="salesTaxName"
							type="text"
							defaultValue={so.salesTaxName ?? ''}
							placeholder='e.g. "DENVER COMBINED"'
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<fieldset style={{ marginTop: '12px' }}>
					<legend>Percentages (blank = use project default)</legend>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
						<label>
							Margin %{' '}
							<input
								name="marginPct"
								type="number"
								step="0.01"
								defaultValue={so.marginPct ?? ''}
								placeholder={projectDefaults.marginPct ?? '—'}
							/>
						</label>
						<label>
							Freight %{' '}
							<input
								name="freightPct"
								type="number"
								step="0.01"
								defaultValue={so.freightPct ?? ''}
								placeholder={projectDefaults.freightPct ?? '—'}
							/>
						</label>
						<label>
							Warehousing %{' '}
							<input
								name="warehousingPct"
								type="number"
								step="0.01"
								defaultValue={so.warehousingPct ?? ''}
								placeholder={projectDefaults.warehousingPct ?? '—'}
							/>
						</label>
						<label>
							Sales tax %{' '}
							<input
								name="salesTaxPct"
								type="number"
								step="0.01"
								defaultValue={so.salesTaxPct ?? ''}
								placeholder={projectDefaults.salesTaxPct ?? '—'}
							/>
						</label>
					</div>
				</fieldset>
				<fieldset style={{ marginTop: '12px' }}>
					<legend>Freight overrides ($)</legend>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
						<label>
							Additional freight $
							<input
								name="additionalFreight"
								type="number"
								step="0.01"
								defaultValue={so.additionalFreight ?? ''}
							/>
						</label>
						<label>
							Freight override $ (replaces freight %)
							<input
								name="freightOverride"
								type="number"
								step="0.01"
								defaultValue={so.freightOverride ?? ''}
							/>
						</label>
					</div>
				</fieldset>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Description
					<br />
					<input
						name="description"
						type="text"
						defaultValue={so.description ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Internal notes
					<br />
					<textarea
						name="notes"
						rows={3}
						defaultValue={so.notes ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Custom email message (goes in the SO email to the contractor)
					<br />
					<textarea
						name="customEmailMessage"
						rows={3}
						defaultValue={so.customEmailMessage ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<div style={{ marginTop: '12px' }}>
					<button className="primary" type="submit" disabled={headerPending}>
						{headerPending ? 'Saving…' : 'Save SO details'}
					</button>
					{headerState?.ok && <span className="flash success">Saved.</span>}
					{headerState?.error && <span className="flash error">{headerState.error}</span>}
				</div>
			</form>

			<p className="muted" style={{ marginTop: '24px' }}>
				PDF + email to contractor coming next. For now SO lives as a draft record;
				create POs to push to reps.
			</p>
		</>
	);
}

function Stat({
	label,
	value,
	highlight
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div
			style={{
				padding: '8px 10px',
				background: highlight ? '#e3f2fd' : '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '16px', fontWeight: 600 }}>{value}</div>
		</div>
	);
}

function EditNumber({
	value,
	orig,
	onChange,
	pending,
	width,
	step = '1'
}: {
	value: string;
	orig: string;
	onChange: (v: string) => void;
	pending: boolean;
	width: string;
	step?: string;
}) {
	const dirty = value !== orig;
	return (
		<input
			type="number"
			step={step}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			disabled={pending}
			placeholder="—"
			style={{
				width,
				textAlign: 'right',
				background: dirty ? '#fff' : 'transparent',
				border: dirty ? '1px solid #856404' : '1px solid transparent'
			}}
		/>
	);
}

function EditText({
	value,
	orig,
	onChange,
	pending,
	width,
	datalist,
	upper
}: {
	value: string;
	orig: string;
	onChange: (v: string) => void;
	pending: boolean;
	width: string;
	datalist?: string;
	upper?: boolean;
}) {
	const dirty = value !== orig;
	return (
		<input
			type="text"
			value={value}
			list={datalist}
			onChange={(e) => onChange(e.target.value)}
			disabled={pending}
			placeholder="—"
			style={{
				width,
				background: dirty ? '#fff' : 'transparent',
				border: dirty ? '1px solid #856404' : '1px solid transparent',
				textTransform: upper ? 'uppercase' : 'none'
			}}
		/>
	);
}

function StatusBadge({ status }: { status: string }) {
	const styles: Record<string, React.CSSProperties> = {
		draft: { background: '#e0e0e0', color: '#555' },
		confirmed: { background: '#e3f2fd', color: '#1565c0' },
		shipped: { background: '#fff3cd', color: '#856404' },
		invoiced: { background: '#e8f5e9', color: '#2e7d32' },
		closed: { background: '#f5f5f5', color: '#999' },
		cancelled: { background: '#ffebee', color: '#c62828' }
	};
	const s = styles[status] ?? styles.draft;
	return (
		<span
			style={{
				...s,
				padding: '2px 8px',
				borderRadius: '3px',
				fontSize: '11px',
				fontWeight: 600,
				textTransform: 'uppercase'
			}}
		>
			{status}
		</span>
	);
}
