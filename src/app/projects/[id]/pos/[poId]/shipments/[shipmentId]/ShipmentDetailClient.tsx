'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import {
	updateShipmentHeader,
	saveShipmentLines,
	markReceived,
	deleteShipment,
	type ShipmentHeaderResult
} from './actions';

type Shipment = {
	id: string;
	shipmentNo: string;
	status: string;
	carrier: string | null;
	trackingNumber: string | null;
	expectedDate: string | null;
	shippedDate: string | null;
	receivedDate: string | null;
	receivedAtLocation: string | null;
	notes: string | null;
	internalNotes: string | null;
	rowVersion: number;
	createdAt: string;
	creatorEmail: string | null;
};

type Line = {
	id: string;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
	unitDn: string | null;
	thisShipmentQty: string;
	thisShipmentNotes: string | null;
	otherShipmentsQty: string;
	otherReceivedQty: string;
};

type Props = {
	projectId: string;
	projectName: string;
	poId: string;
	poNo: string;
	repFirm: string | null;
	shipment: Shipment;
	lines: Line[];
};

const STATUS_OPTIONS = ['expected', 'in_transit', 'received', 'partial', 'cancelled'];

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

export default function ShipmentDetailClient({
	projectId,
	projectName,
	poId,
	poNo,
	repFirm,
	shipment,
	lines
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

	const headerAction = updateShipmentHeader.bind(null, projectId, poId, shipment.id);
	const [headerState, headerFormAction, headerPending] = useActionState<
		ShipmentHeaderResult | undefined,
		FormData
	>(headerAction, undefined);

	// Per-line edits (qty-shipped + notes), seeded from server data.
	const [qtyEdits, setQtyEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.thisShipmentQty]))
	);
	const [notesEdits, setNotesEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.thisShipmentNotes ?? '']))
	);

	function isLineDirty(l: Line) {
		return (
			(qtyEdits[l.id] ?? '') !== l.thisShipmentQty ||
			(notesEdits[l.id] ?? '') !== (l.thisShipmentNotes ?? '')
		);
	}

	const dirtyCount = useMemo(
		() => lines.filter(isLineDirty).length,
		[lines, qtyEdits, notesEdits]
	);

	// Computed totals: how much is on THIS shipment given current edits
	const totals = useMemo(() => {
		let onThisShipment = 0;
		let linesOnThisShipment = 0;
		let overCommitWarnings = 0;
		for (const l of lines) {
			const v = qtyEdits[l.id] ?? '';
			const n = Number(v);
			if (v && !isNaN(n) && n > 0) {
				onThisShipment += n;
				linesOnThisShipment++;
				const ordered = Number(l.qty ?? 0);
				const others = Number(l.otherShipmentsQty ?? 0);
				if (ordered > 0 && others + n > ordered) overCommitWarnings++;
			}
		}
		return { onThisShipment, linesOnThisShipment, overCommitWarnings };
	}, [lines, qtyEdits]);

	function onSaveLines() {
		const changes: { orderLineId: string; qtyShipped: string; notes?: string }[] = [];
		for (const l of lines) {
			if (!isLineDirty(l)) continue;
			changes.push({
				orderLineId: l.id,
				qtyShipped: qtyEdits[l.id] ?? '',
				notes: notesEdits[l.id] ?? ''
			});
		}
		if (changes.length === 0) {
			flashThen('Nothing to save.');
			return;
		}
		startTransition(async () => {
			const r = await saveShipmentLines(shipment.id, JSON.stringify({ changes }));
			if (r?.error) {
				errorThen(r.error);
				return;
			}
			let msg = `Saved.`;
			if (r.upserted > 0) msg += ` ${r.upserted} line${r.upserted === 1 ? '' : 's'} added/updated.`;
			if (r.deleted > 0) msg += ` ${r.deleted} removed.`;
			if (r.rejected.length > 0) {
				msg += ` ${r.rejected.length} rejected: ${r.rejected.map((x) => x.reason).join('; ')}`;
				errorThen(msg);
			} else {
				flashThen(msg);
				// Force a refresh so the server-side "thisShipmentQty" values re-seed
				// the inputs cleanly; otherwise dirty detection compares to stale data.
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onMarkReceived() {
		if (!confirm(`Mark ${shipment.shipmentNo} as received? This stamps the received date.`))
			return;
		startTransition(async () => {
			const r = await markReceived(projectId, poId, shipment.id);
			if (r?.error) errorThen(r.error);
			else {
				flashThen('Marked received.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onDelete() {
		if (
			!confirm(
				`Delete ${shipment.shipmentNo}? This removes the shipment and its line entries. The order lines themselves are not deleted.`
			)
		)
			return;
		startTransition(async () => {
			await deleteShipment(projectId, poId, shipment.id);
		});
	}

	const isReceived = shipment.status === 'received';

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/pos/${poId}/shipments`}>
					← Shipments for {poNo}
				</a>
			</p>

			<h1>
				{shipment.shipmentNo} — {poNo}
				{repFirm && <span className="muted"> ({repFirm})</span>}
			</h1>
			<p className="muted">
				<StatusBadge status={shipment.status} /> · {projectName}
				{shipment.receivedDate && (
					<> · received {new Date(shipment.receivedDate).toLocaleDateString()}</>
				)}
				{shipment.creatorEmail && <> · created by {shipment.creatorEmail}</>}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			{!isReceived && (
				<div style={{ display: 'flex', gap: '12px', margin: '12px 0' }}>
					<button className="primary" onClick={onMarkReceived} disabled={pending}>
						Mark received
					</button>
					<button onClick={onDelete} disabled={pending} style={{ marginLeft: 'auto' }}>
						Delete shipment
					</button>
				</div>
			)}

			<h2>This shipment</h2>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					gap: '8px',
					maxWidth: '700px',
					marginBottom: '16px'
				}}
			>
				<Stat label="Lines on this shipment" value={totals.linesOnThisShipment.toString()} />
				<Stat label="Total QTY on this shipment" value={totals.onThisShipment.toLocaleString()} />
				<Stat
					label="Over-commit warnings"
					value={totals.overCommitWarnings.toString()}
					highlight={totals.overCommitWarnings > 0}
				/>
			</div>

			<h2>Lines</h2>
			<div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
				<button
					className="primary"
					onClick={onSaveLines}
					disabled={pending || dirtyCount === 0}
				>
					{pending
						? 'Saving…'
						: `Save lines (${dirtyCount} edited)`}
				</button>
				<span className="muted">
					Enter the quantity of each PO line that&apos;s on this shipment. Leave blank or 0 to
					exclude a line.
				</span>
			</div>

			{lines.length === 0 ? (
				<p className="muted">This PO has no lines yet.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px' }}>
					<thead>
						<tr>
							<th>TYPE</th>
							<th>CATALOG #</th>
							<th>MANUFACTURER</th>
							<th style={{ textAlign: 'right' }}>ORDERED</th>
							<th style={{ textAlign: 'right' }}>OTHER SHIPMENTS</th>
							<th style={{ textAlign: 'right' }}>OTHER RECEIVED</th>
							<th style={{ textAlign: 'right' }}>STILL OPEN</th>
							<th style={{ textAlign: 'right' }}>ON THIS SHIPMENT</th>
							<th>NOTES</th>
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => {
							const ordered = Number(l.qty ?? 0);
							const others = Number(l.otherShipmentsQty ?? 0);
							const otherReceived = Number(l.otherReceivedQty ?? 0);
							const stillOpen = Math.max(ordered - others, 0);
							const onThis = Number(qtyEdits[l.id] ?? 0);
							const overCommit = ordered > 0 && others + onThis > ordered;
							const dirty = isLineDirty(l);
							const bg = dirty ? { background: '#fff3cd' } : undefined;
							return (
								<tr key={l.id} style={bg}>
									<td>{l.type ?? '—'}</td>
									<td>{l.catalogNo ?? '—'}</td>
									<td>{l.manufacturer ?? '—'}</td>
									<td style={{ textAlign: 'right' }}>
										{ordered.toLocaleString()} {l.qtyType ?? ''}
									</td>
									<td style={{ textAlign: 'right' }} className="muted">
										{others.toLocaleString()}
									</td>
									<td style={{ textAlign: 'right' }} className="muted">
										{otherReceived.toLocaleString()}
									</td>
									<td style={{ textAlign: 'right' }}>
										<strong>{stillOpen.toLocaleString()}</strong>
									</td>
									<td style={{ textAlign: 'right' }}>
										<input
											type="number"
											step="0.01"
											value={qtyEdits[l.id] ?? ''}
											onChange={(e) =>
												setQtyEdits({ ...qtyEdits, [l.id]: e.target.value })
											}
											disabled={pending || isReceived}
											style={{
												width: '80px',
												textAlign: 'right',
												border: overCommit ? '2px solid #c00' : undefined
											}}
											title={
												overCommit
													? `Over-commit: ${others} on other shipments + ${onThis} here = ${others + onThis}, more than ${ordered} ordered.`
													: undefined
											}
										/>
									</td>
									<td>
										<input
											type="text"
											value={notesEdits[l.id] ?? ''}
											onChange={(e) =>
												setNotesEdits({ ...notesEdits, [l.id]: e.target.value })
											}
											disabled={pending || isReceived}
											placeholder="e.g. damaged box, missing parts"
											style={{ width: '180px' }}
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}

			{totals.overCommitWarnings > 0 && (
				<p className="flash info" style={{ marginTop: '12px' }}>
					<strong>Over-commit warning:</strong> {totals.overCommitWarnings} line
					{totals.overCommitWarnings === 1 ? '' : 's'} have more committed (this + other
					shipments) than were ordered. Manufacturers sometimes ship extras — the save is allowed,
					but double-check.
				</p>
			)}

			<h2 style={{ marginTop: '32px' }}>Shipment details</h2>
			{headerState?.error && <p className="flash error">{headerState.error}</p>}
			{headerState?.ok && <p className="flash success">Saved.</p>}
			<form action={headerFormAction}>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '12px',
						maxWidth: '900px'
					}}
				>
					<label>
						Status
						<br />
						<select
							name="status"
							defaultValue={shipment.status}
							style={{ width: '100%' }}
						>
							{STATUS_OPTIONS.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
					<label>
						Received at (location)
						<br />
						<input
							name="receivedAtLocation"
							type="text"
							defaultValue={shipment.receivedAtLocation ?? ''}
							placeholder="warehouse / jobsite / 123 Main St"
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
						Carrier
						<br />
						<input
							name="carrier"
							type="text"
							defaultValue={shipment.carrier ?? ''}
							placeholder="FedEx / UPS / freight company"
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Tracking #
						<br />
						<input
							name="trackingNumber"
							type="text"
							defaultValue={shipment.trackingNumber ?? ''}
							style={{ width: '100%' }}
						/>
					</label>
				</div>

				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr 1fr',
						gap: '12px',
						marginTop: '12px'
					}}
				>
					<label>
						Expected date
						<br />
						<input
							name="expectedDate"
							type="date"
							defaultValue={toDateInput(shipment.expectedDate)}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Shipped date
						<br />
						<input
							name="shippedDate"
							type="date"
							defaultValue={toDateInput(shipment.shippedDate)}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Received date
						<br />
						<input
							name="receivedDate"
							type="date"
							defaultValue={toDateInput(shipment.receivedDate)}
							style={{ width: '100%' }}
						/>
					</label>
				</div>

				<label style={{ display: 'block', marginTop: '12px' }}>
					Notes (visible to anyone in the system)
					<textarea
						name="notes"
						rows={2}
						defaultValue={shipment.notes ?? ''}
						style={{ width: '100%' }}
					/>
				</label>

				<label style={{ display: 'block', marginTop: '12px' }}>
					Internal notes (never leaves Ebisu)
					<textarea
						name="internalNotes"
						rows={2}
						defaultValue={shipment.internalNotes ?? ''}
						style={{ width: '100%' }}
					/>
				</label>

				<div style={{ marginTop: '16px' }}>
					<button className="primary" type="submit" disabled={headerPending}>
						{headerPending ? 'Saving…' : 'Save shipment details'}
					</button>
				</div>
			</form>
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
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div
				style={{
					fontSize: '16px',
					fontWeight: 600,
					color: highlight ? '#c00' : '#111'
				}}
			>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		expected: { bg: '#e8eef5', fg: '#234' },
		in_transit: { bg: '#fff3cd', fg: '#7a5d00' },
		received: { bg: '#d4edda', fg: '#155724' },
		partial: { bg: '#ffe4c2', fg: '#8a4a00' },
		cancelled: { bg: '#f5d6d6', fg: '#7a1212' }
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
