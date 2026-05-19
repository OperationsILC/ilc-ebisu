'use client';

import { useState, useTransition } from 'react';
import { setShipQapExpected, toggleShipQapHidden } from './actions';

export type ShipQapGlobalRow = {
	id: string;
	projectId: string;
	projectName: string;
	typeName: string;
	catalogNo: string;
	manufacturer: string | null;
	qtyNeeded: number;
	qtyOnPo: number;
	poNos: string[];
	qtyShipped: number;
	qtyReceived: number;
	qtyOpen: number;
	fullyReceived: boolean;
	expectedShipDate: string | null;
	expectedArrivalDate: string | null;
	expectedShipNotes: string | null;
	hidden: boolean;
};

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

export default function GlobalShipQapClient({ rows }: { rows: ShipQapGlobalRow[] }) {
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
		return <p className="muted">No rows match the current filters.</p>;
	}

	return (
		<>
			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<div style={{ overflowX: 'auto' }}>
				<table className="plain" style={{ minWidth: '1300px', fontSize: '12px', width: '100%' }}>
					<thead>
						<tr>
							<th>Hide</th>
							<th>Project</th>
							<th>Type</th>
							<th>Catalog #</th>
							<th>Manufacturer</th>
							<th style={{ textAlign: 'right' }}>Needed</th>
							<th style={{ textAlign: 'right' }}>On PO</th>
							<th style={{ textAlign: 'right' }}>Open</th>
							<th>Expected ship</th>
							<th>Expected arrival</th>
							<th>Notes</th>
							<th style={{ textAlign: 'right' }}>Received</th>
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
	row: ShipQapGlobalRow;
	onFlash: (s: string) => void;
	onError: (s: string) => void;
}) {
	const [pending, startTransition] = useTransition();
	const [shipDate, setShipDate] = useState(toDateInput(row.expectedShipDate));
	const [arrivalDate, setArrivalDate] = useState(toDateInput(row.expectedArrivalDate));
	const [notes, setNotes] = useState(row.expectedShipNotes ?? '');

	type ExpectedField = 'expectedShipDate' | 'expectedArrivalDate' | 'expectedShipNotes';
	function saveField(field: ExpectedField, value: string) {
		const updates: Partial<Record<ExpectedField, string>> = {};
		updates[field] = value;
		startTransition(async () => {
			const r = await setShipQapExpected(row.id, updates);
			if (r.error) onError(r.error);
			else onFlash('Saved.');
		});
	}

	function onToggleHide() {
		startTransition(async () => {
			const r = await toggleShipQapHidden(row.id);
			if (r.error) onError(r.error);
			else onFlash(r.nowHidden ? 'Row hidden.' : 'Row restored.');
		});
	}

	const rowBg = row.hidden
		? '#f5f5f5'
		: row.fullyReceived
			? '#e8f5e9'
			: row.qtyOpen > 0
				? '#fff3cd'
				: '#fff';

	return (
		<tr style={{ background: rowBg, opacity: row.hidden ? 0.55 : 1 }}>
			<td style={{ textAlign: 'center' }}>
				<button
					onClick={onToggleHide}
					disabled={pending}
					style={{ fontSize: '11px', padding: '2px 6px' }}
				>
					{row.hidden ? 'Unhide' : 'Hide'}
				</button>
			</td>
			<td>
				<a href={`/projects/${row.projectId}/ship-qap`}>{row.projectName}</a>
			</td>
			<td>{row.typeName}</td>
			<td>{row.catalogNo}</td>
			<td>{row.manufacturer ?? '—'}</td>
			<td style={{ textAlign: 'right' }}>{row.qtyNeeded || '—'}</td>
			<td style={{ textAlign: 'right' }}>
				{row.qtyOnPo || '—'}
				{row.poNos.length > 0 && (
					<div className="muted" style={{ fontSize: '10px' }}>
						{row.poNos.join(', ')}
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
					placeholder="—"
					style={{ width: '140px', fontSize: '11px' }}
				/>
			</td>
			<td
				style={{
					textAlign: 'right',
					fontWeight: row.fullyReceived ? 700 : 400,
					color: row.fullyReceived ? '#0a7c2f' : '#333'
				}}
			>
				{row.qtyReceived || '—'}
			</td>
		</tr>
	);
}
