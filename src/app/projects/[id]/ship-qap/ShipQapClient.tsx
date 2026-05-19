'use client';

import { useState, useTransition } from 'react';
import { setShipQapExpected, toggleShipQapHidden } from '@/app/ship-qap/actions';

export type ShipQapRow = {
	id: string;
	qapIdText: string | null;
	typeName: string;
	catalogNo: string;
	manufacturer: string | null;
	description: string | null;
	finish: string | null;
	qtyNeeded: number;
	notes: string | null;
	expectedShipDate: string | null; // ISO
	expectedArrivalDate: string | null;
	expectedShipNotes: string | null;
	procurement: {
		qtyOnPo: number;
		pos: Array<{ id: string; no: string; status: string; repFirm: string | null }>;
	};
	shipment: {
		qtyShipped: number;
		qtyReceived: number;
		shipments: Array<{
			id: string;
			no: string;
			status: string;
			expectedDate: string | null;
			receivedDate: string | null;
		}>;
	};
	qtyOpen: number;
	fullyReceived: boolean;
	hidden: boolean;
};

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

export default function ShipQapClient({
	projectId,
	rows
}: {
	projectId: string;
	rows: ShipQapRow[];
}) {
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 3000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	if (rows.length === 0) {
		return (
			<p className="muted">
				No rows to show with the current filters. (Are you hiding everything?){' '}
				<a href={`/projects/${projectId}/ship-qap?showHidden=1`}>Show hidden</a>
			</p>
		);
	}

	return (
		<>
			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<div style={{ overflowX: 'auto' }}>
				<table
					className="plain"
					style={{ minWidth: '1200px', fontSize: '12px', width: '100%' }}
				>
					<thead>
						<tr>
							<th rowSpan={2} style={{ minWidth: '70px' }}>
								Hide
							</th>
							<th colSpan={5} style={{ background: '#eef6ff' }}>
								QAP
							</th>
							<th colSpan={2} style={{ background: '#fff3e0' }}>
								Procurement
							</th>
							<th colSpan={3} style={{ background: '#fff8e1' }}>
								Expected (you plan)
							</th>
							<th colSpan={3} style={{ background: '#e8f5e9' }}>
								Reality (shipments)
							</th>
						</tr>
						<tr>
							<th>Type</th>
							<th>Catalog #</th>
							<th>Manufacturer</th>
							<th style={{ textAlign: 'right' }}>Qty needed</th>
							<th>Description</th>
							<th style={{ textAlign: 'right' }}>On PO</th>
							<th style={{ textAlign: 'right' }}>Open</th>
							<th>Ship date</th>
							<th>Arrival date</th>
							<th>Notes</th>
							<th style={{ textAlign: 'right' }}>Shipped</th>
							<th style={{ textAlign: 'right' }}>Received</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<Row
								key={r.id}
								row={r}
								onFlash={flashThen}
								onError={errorThen}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function Row({
	row,
	onFlash,
	onError
}: {
	row: ShipQapRow;
	onFlash: (s: string) => void;
	onError: (s: string) => void;
}) {
	const [pending, startTransition] = useTransition();
	const [shipDate, setShipDate] = useState(toDateInput(row.expectedShipDate));
	const [arrivalDate, setArrivalDate] = useState(toDateInput(row.expectedArrivalDate));
	const [notes, setNotes] = useState(row.expectedShipNotes ?? '');

	// Latest shipment status — show that one as the "current state"
	const latestShipment = row.shipment.shipments[0]; // already insertion-order

	const rowBg = row.hidden
		? '#f5f5f5'
		: row.fullyReceived
			? '#e8f5e9'
			: row.qtyOpen > 0
				? '#fff3cd'
				: '#fff';

	type ExpectedField = 'expectedShipDate' | 'expectedArrivalDate' | 'expectedShipNotes';

	function saveField(field: ExpectedField, value: string) {
		const updates: Partial<Record<ExpectedField, string>> = {};
		updates[field] = value;
		startTransition(async () => {
			const r = await setShipQapExpected(row.id, updates);
			if (r.error) onError(r.error);
			else onFlash(`Saved ${field}.`);
		});
	}

	function onToggleHide() {
		startTransition(async () => {
			const r = await toggleShipQapHidden(row.id);
			if (r.error) onError(r.error);
			else onFlash(r.nowHidden ? 'Row hidden.' : 'Row restored.');
		});
	}

	return (
		<tr style={{ background: rowBg, opacity: row.hidden ? 0.55 : 1 }}>
			<td style={{ textAlign: 'center' }}>
				<button
					onClick={onToggleHide}
					disabled={pending}
					title={row.hidden ? 'Unhide this row' : 'Hide this row from your ShipQAP'}
					style={{ fontSize: '11px', padding: '2px 6px' }}
				>
					{row.hidden ? 'Unhide' : 'Hide'}
				</button>
			</td>
			<td>{row.typeName}</td>
			<td>{row.catalogNo}</td>
			<td>{row.manufacturer ?? '—'}</td>
			<td style={{ textAlign: 'right' }}>{row.qtyNeeded || '—'}</td>
			<td className="muted" style={{ maxWidth: '180px', fontSize: '11px' }}>
				{row.description ?? '—'}
			</td>
			<td style={{ textAlign: 'right' }}>
				{row.procurement.qtyOnPo || '—'}
				{row.procurement.pos.length > 0 && (
					<div className="muted" style={{ fontSize: '10px' }}>
						{row.procurement.pos.map((p) => p.no).join(', ')}
					</div>
				)}
			</td>
			<td
				style={{
					textAlign: 'right',
					fontWeight: row.qtyOpen > 0 ? 700 : 400,
					color: row.qtyOpen > 0 ? '#c00' : '#333'
				}}
			>
				{row.qtyOpen || '—'}
			</td>
			<td>
				<input
					type="date"
					value={shipDate}
					onChange={(e) => setShipDate(e.target.value)}
					onBlur={() => {
						if (shipDate !== toDateInput(row.expectedShipDate)) {
							saveField('expectedShipDate', shipDate);
						}
					}}
					disabled={pending}
					style={{ width: '120px', fontSize: '11px' }}
				/>
			</td>
			<td>
				<input
					type="date"
					value={arrivalDate}
					onChange={(e) => setArrivalDate(e.target.value)}
					onBlur={() => {
						if (arrivalDate !== toDateInput(row.expectedArrivalDate)) {
							saveField('expectedArrivalDate', arrivalDate);
						}
					}}
					disabled={pending}
					style={{ width: '120px', fontSize: '11px' }}
				/>
			</td>
			<td>
				<input
					type="text"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					onBlur={() => {
						if (notes !== (row.expectedShipNotes ?? '')) {
							saveField('expectedShipNotes', notes);
						}
					}}
					disabled={pending}
					placeholder="e.g. split shipment"
					style={{ width: '160px', fontSize: '11px' }}
				/>
			</td>
			<td style={{ textAlign: 'right' }}>{row.shipment.qtyShipped || '—'}</td>
			<td
				style={{
					textAlign: 'right',
					fontWeight: row.fullyReceived ? 700 : 400,
					color: row.fullyReceived ? '#0a7c2f' : '#333'
				}}
			>
				{row.shipment.qtyReceived || '—'}
			</td>
			<td className="muted" style={{ fontSize: '11px' }}>
				{latestShipment ? (
					<>
						<div>{latestShipment.status}</div>
						{latestShipment.expectedDate && (
							<div>exp {new Date(latestShipment.expectedDate).toLocaleDateString()}</div>
						)}
						{latestShipment.receivedDate && (
							<div>got {new Date(latestShipment.receivedDate).toLocaleDateString()}</div>
						)}
					</>
				) : (
					'—'
				)}
			</td>
		</tr>
	);
}
