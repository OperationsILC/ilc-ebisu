'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { updatePoHeader, savePoLineEdits, sendPoEmail, type PoHeaderResult } from './actions';
import { SendPanel } from '@/app/components/SendPanel';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 2
});
const QTY_TYPE_SUGGESTIONS = ['EA', 'LF', 'FT', 'KIT', 'SET', 'ROLL', 'BOX', 'PCS'];

type Po = {
	id: string;
	poNo: string;
	status: string;
	description: string | null;
	notes: string | null;
	internalNotes: string | null;
	customEmailMessage: string | null;
	addedFreight: string | null;
	repQuoteNo: string | null;
	trackingNumber: string | null;
	orderedDate: string | null;
	acknowledgedAt: string | null;
	shipToText: string | null;
	ilcOfficeAddress: string | null;
	sendFromEmail: string | null;
	sendToEmail: string | null;
	sentAt: string | null;
	versionNo: number;
	createdAt: string;
	repFirm: string | null;
	repFirmQuoteEmails: string | null;
	repFirmOrderEmails: string | null;
	creatorEmail: string | null;
	soNo: string | null;
	soId: string | null;
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
	receivedQty: number;
	committedQty: number;
};

type ShipmentRollup = {
	shipmentCount: number;
	receivedCount: number;
};

type Props = {
	projectId: string;
	projectName: string;
	po: Po;
	lines: Line[];
	shipmentRollup: ShipmentRollup;
};

export default function PoDetailClient({
	projectId,
	projectName,
	po,
	lines,
	shipmentRollup
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

	const headerAction = updatePoHeader.bind(null, projectId, po.id);
	const [headerState, headerFormAction, headerPending] = useActionState<
		PoHeaderResult | undefined,
		FormData
	>(headerAction, undefined);

	// --- Line edits ---
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

	// PO-focused totals: DN side
	const totals = useMemo(() => {
		let totalQty = 0;
		let totalDn = 0;
		for (const l of lines) {
			const qty = effective(qtyEdits, l, l.qty);
			const dn = effective(dnEdits, l, l.unitDn);
			totalQty += qty;
			totalDn += qty * dn;
		}
		const addedFreight = Number(po.addedFreight ?? 0);
		const grandTotal = totalDn + addedFreight;
		return { totalQty, totalDn, addedFreight, grandTotal };
	}, [lines, qtyEdits, dnEdits, po.addedFreight]);

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
			const r = await savePoLineEdits(po.id, JSON.stringify({ changes }));
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

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/pos`}>← Purchase Orders for {projectName}</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>
					{po.poNo} — {po.repFirm ?? '(no rep firm)'}
				</h1>
				<a
					href={`/projects/${projectId}/pos/${po.id}/pdf`}
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px' }}
				>
					Download PDF ↗
				</a>
			</div>
			<p className="muted">
				<StatusBadge status={po.status} /> · {projectName} · v{po.versionNo}
				{po.soNo && (
					<>
						{' '}
						· SO <a href={`/projects/${projectId}/sos/${po.soId}`}>{po.soNo}</a>
					</>
				)}
				{po.sentAt && <> · sent {new Date(po.sentAt).toLocaleDateString()}</>}
				{po.orderedDate && <> · ordered {new Date(po.orderedDate).toLocaleDateString()}</>}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<SendPanel
				docKindLabel="PO"
				docNo={po.poNo}
				defaultTo={po.sendToEmail ?? po.repFirmOrderEmails ?? ''}
				onSend={async (to) => {
					const r = await sendPoEmail(projectId, po.id, to);
					if (r.error) errorThen(r.error);
					else {
						let msg = `Sent to ${r.sentTo?.join(', ') ?? ''}.`;
						if (r.redirectedTo)
							msg += ` (DEV_EMAIL_REDIRECT diverted to ${r.redirectedTo.join(', ')})`;
						flashThen(msg);
						setTimeout(() => window.location.reload(), 600);
					}
				}}
				pending={pending}
				startTransition={startTransition}
			/>

			<datalist id="qty-type-suggestions">
				{QTY_TYPE_SUGGESTIONS.map((s) => (
					<option key={s} value={s} />
				))}
			</datalist>

			<h2 style={{ marginBottom: '4px' }}>Shipments</h2>
			<p style={{ margin: '0 0 12px 0' }}>
				<a href={`/projects/${projectId}/pos/${po.id}/shipments`}>
					{shipmentRollup.shipmentCount === 0
						? 'No shipments yet — track partial deliveries here →'
						: `${shipmentRollup.shipmentCount} shipment${
								shipmentRollup.shipmentCount === 1 ? '' : 's'
							} (${shipmentRollup.receivedCount} received) →`}
				</a>
			</p>

			<h2 style={{ marginBottom: '4px' }}>Change Orders</h2>
			<p style={{ margin: '0 0 12px 0' }}>
				<a href={`/projects/${projectId}/pos/${po.id}/change-orders`}>
					Track versioned modifications to this PO →
				</a>
			</p>

			<h2>Totals (DN side)</h2>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
					gap: '8px',
					maxWidth: '700px',
					marginBottom: '16px'
				}}
			>
				<Stat label="Total QTY" value={totals.totalQty.toLocaleString()} />
				<Stat label="DN Subtotal" value={usd.format(totals.totalDn)} />
				<Stat label="Added freight" value={usd.format(totals.addedFreight)} />
				<Stat label="PO Total" value={usd.format(totals.grandTotal)} highlight />
			</div>

			<h2>Lines ({lines.length})</h2>
			<div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
				<button
					className="primary"
					onClick={onSaveLineEdits}
					disabled={pending || dirtyCount === 0}
				>
					{pending
						? 'Saving…'
						: `Save changes (${dirtyCount} row${dirtyCount === 1 ? '' : 's'} edited)`}
				</button>
				<span className="muted">Edits sync to the linked SO automatically (shared rows).</span>
			</div>

			{lines.length === 0 ? (
				<p className="muted">No lines on this PO. They&apos;re added via the SO.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px' }}>
					<thead>
						<tr>
							<th>TYPE</th>
							<th>CATALOG #</th>
							<th>MANUFACTURER</th>
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th style={{ textAlign: 'right' }} className="muted">RCVD</th>
							<th>QTY TYPE</th>
							<th style={{ textAlign: 'right' }}>UNIT DN</th>
							<th style={{ textAlign: 'right' }}>MARGIN %</th>
							<th style={{ textAlign: 'right' }}>UNIT CN</th>
							<th>REP QUOTE #</th>
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
									<td
										style={{ textAlign: 'right' }}
										className="muted"
										title={
											l.committedQty > l.receivedQty
												? `${l.receivedQty} received, ${l.committedQty - l.receivedQty} more on expected/in-transit shipments`
												: undefined
										}
									>
										{l.receivedQty > 0 || l.committedQty > 0
											? `${l.receivedQty}${l.committedQty > l.receivedQty ? `+${l.committedQty - l.receivedQty}` : ''}`
											: '—'}
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
								</tr>
							);
						})}
					</tbody>
				</table>
			)}

			<h2 style={{ marginTop: '32px' }}>PO Details</h2>
			<form action={headerFormAction} style={{ maxWidth: '900px' }}>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
					<label>
						Status
						<br />
						<select name="status" defaultValue={po.status}>
							{[
								'draft',
								'sent',
								'acknowledged',
								'shipped',
								'received',
								'closed',
								'cancelled',
								'dont_send'
							].map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
					<label>
						Tracking #
						<br />
						<input
							name="trackingNumber"
							type="text"
							defaultValue={po.trackingNumber ?? ''}
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '12px',
						marginTop: '12px'
					}}
				>
					<label>
						Added freight $
						<input
							name="addedFreight"
							type="number"
							step="0.01"
							defaultValue={po.addedFreight ?? ''}
						/>
					</label>
					<label>
						Rep quote # (PO-level override)
						<input
							name="repQuoteNo"
							type="text"
							defaultValue={po.repQuoteNo ?? ''}
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Description
					<input
						name="description"
						type="text"
						defaultValue={po.description ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '12px',
						marginTop: '12px'
					}}
				>
					<label>
						Send-from email
						<input
							name="sendFromEmail"
							type="email"
							defaultValue={po.sendFromEmail ?? ''}
							placeholder="orders@ilcstudios.com"
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Send-to email
						<input
							name="sendToEmail"
							type="email"
							defaultValue={po.sendToEmail ?? po.repFirmOrderEmails ?? ''}
							placeholder={po.repFirmOrderEmails ?? 'rep@example.com'}
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Custom email message (goes in the PO email to the rep)
					<textarea
						name="customEmailMessage"
						rows={3}
						defaultValue={po.customEmailMessage ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Ship-to (override; default is project delivery address)
					<textarea
						name="shipToText"
						rows={4}
						defaultValue={po.shipToText ?? ''}
						placeholder={'Contact name\nCompany\nPhone\nStreet, City, State ZIP'}
						style={{ width: '100%' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					ILC office address
					<textarea
						name="ilcOfficeAddress"
						rows={3}
						defaultValue={po.ilcOfficeAddress ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Public notes (for rep)
					<textarea name="notes" rows={2} defaultValue={po.notes ?? ''} style={{ width: '100%' }} />
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Internal notes (never sent to rep)
					<textarea
						name="internalNotes"
						rows={3}
						defaultValue={po.internalNotes ?? ''}
						style={{ width: '100%' }}
					/>
				</label>
				<div style={{ marginTop: '12px' }}>
					<button className="primary" type="submit" disabled={headerPending}>
						{headerPending ? 'Saving…' : 'Save PO details'}
					</button>
					{headerState?.ok && <span className="flash success">Saved.</span>}
					{headerState?.error && <span className="flash error">{headerState.error}</span>}
				</div>
			</form>

			<p className="muted" style={{ marginTop: '24px' }}>
				PDF generation and email send to the rep are next. For now the PO is an internal
				record. Created by {po.creatorEmail ?? '—'} on{' '}
				{new Date(po.createdAt).toLocaleString()}.
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
		sent: { background: '#e3f2fd', color: '#1565c0' },
		acknowledged: { background: '#fff3cd', color: '#856404' },
		shipped: { background: '#fff3cd', color: '#856404' },
		received: { background: '#e8f5e9', color: '#2e7d32' },
		closed: { background: '#f5f5f5', color: '#999' },
		cancelled: { background: '#ffebee', color: '#c62828' },
		dont_send: { background: '#e0e0e0', color: '#555' }
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
