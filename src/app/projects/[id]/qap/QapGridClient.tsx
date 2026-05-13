'use client';

import { useRef, useState, useTransition } from 'react';
import EbisuGrid, { type EbisuGridHandle, type DirtyCells } from '@/components/EbisuGrid';
import type { ColDef } from 'ag-grid-community';
import { saveQapChanges, type SaveResult } from './actions';

export type QapRow = {
	id: string;
	rowVersion: number;
	qapIdText: string | null;
	type: string;
	catalogNo: string;
	manufacturer: string | null;
	qty: string | null;
	currentDn: string | null;
	marginPct: string | null;
	fixtureOrControl: string | null;
	finish: string | null;
	cct: string | null;
	wattage: string | null;
	voltage: string | null;
	dim: string | null;
	mounting: string | null;
	roughInRequired: string | null;
	fixtureCategory: string | null;
	fixtureLocation: string | null;
	atticStock: string | null;
	internalDesignerNotes: string | null;
	notes: string | null;
	description: string | null;
};

const columnDefs: ColDef<QapRow>[] = [
	{ field: 'qapIdText', headerName: 'QAP ID', minWidth: 280, pinned: 'left', editable: false },
	{ field: 'type', headerName: 'TYPE', minWidth: 90, editable: false },
	{ field: 'catalogNo', headerName: 'CATALOG #', minWidth: 160, editable: false },
	{ field: 'manufacturer', headerName: 'MANUFACTURER', minWidth: 160, editable: false },
	{ field: 'qty', headerName: 'QTY', minWidth: 70, cellDataType: 'number' },
	{ field: 'currentDn', headerName: 'CURRENT DN', minWidth: 110, cellDataType: 'number' },
	{ field: 'marginPct', headerName: 'MARGIN %', minWidth: 90, cellDataType: 'number' },
	{ field: 'fixtureOrControl', headerName: 'FIX/CTRL', minWidth: 100, editable: false },
	{ field: 'finish', headerName: 'FINISH', minWidth: 120 },
	{ field: 'cct', headerName: 'CCT', minWidth: 140 },
	{ field: 'wattage', headerName: 'WATTAGE', minWidth: 90 },
	{ field: 'voltage', headerName: 'VOLTAGE', minWidth: 90 },
	{ field: 'dim', headerName: 'DIM', minWidth: 80 },
	{ field: 'mounting', headerName: 'MOUNTING', minWidth: 110 },
	{ field: 'roughInRequired', headerName: 'ROUGH-IN', minWidth: 90 },
	{ field: 'fixtureCategory', headerName: 'CATEGORY', minWidth: 120 },
	{ field: 'fixtureLocation', headerName: 'LOCATION', minWidth: 140 },
	{ field: 'atticStock', headerName: 'ATTIC STOCK', minWidth: 90 },
	{ field: 'internalDesignerNotes', headerName: 'DESIGNER NOTES', minWidth: 220 },
	{ field: 'notes', headerName: 'NOTES', minWidth: 220 },
	{ field: 'description', headerName: 'DESCRIPTION', minWidth: 320 }
];

export default function QapGridClient({
	projectId,
	rows
}: {
	projectId: string;
	rows: QapRow[];
}) {
	const gridRef = useRef<EbisuGridHandle>(null);
	const [dirtyCount, setDirtyCount] = useState(0);
	const [result, setResult] = useState<SaveResult | null>(null);
	const [pending, startTransition] = useTransition();

	function onDirtyChange(d: Map<string, DirtyCells>) {
		setDirtyCount(d.size);
	}

	function onSave() {
		const dirty = gridRef.current?.getDirty();
		if (!dirty || dirty.size === 0) {
			setResult({ accepted: [], rejected: [], error: 'Nothing to save.' });
			return;
		}
		const rowsById = new Map(rows.map((r) => [r.id, r]));
		const changes = Array.from(dirty.entries()).map(([id, cells]) => {
			const row = rowsById.get(id);
			return { id, row_version: row?.rowVersion ?? 1, cells };
		});
		const payload = JSON.stringify({ changes });

		startTransition(async () => {
			const r = await saveQapChanges(projectId, payload);
			setResult(r);
			if (r.accepted.length > 0 || r.rejected.length === 0) {
				gridRef.current?.clearDirty();
				setDirtyCount(0);
			}
		});
	}

	return (
		<>
			<div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '12px 0' }}>
				<button
					className="primary"
					onClick={onSave}
					disabled={dirtyCount === 0 || pending}
					type="button"
				>
					{pending ? 'Saving…' : 'Save changes'}
				</button>
				<span className="dirty-badge">
					{dirtyCount} dirty row{dirtyCount === 1 ? '' : 's'}
				</span>
				<a href={`/projects/${projectId}/qap/import`}>+ Import CSV</a>
			</div>

			{result?.error && <p className="flash error">{result.error}</p>}
			{result && result.accepted.length > 0 && (
				<p className="flash success">
					Saved {result.accepted.length} row{result.accepted.length === 1 ? '' : 's'}.
					{result.rejected.length > 0 && <strong> {result.rejected.length} rejected.</strong>}
				</p>
			)}
			{result && result.rejected.length > 0 && (
				<details className="flash error">
					<summary>
						{result.rejected.length} row{result.rejected.length === 1 ? '' : 's'} rejected — click
						to see why
					</summary>
					<ul>
						{result.rejected.map((r) => (
							<li key={r.id}>
								<code>{r.id}</code>: {r.reason}
								{r.reason === 'stale_row_version' && (
									<> (server is at v{r.server_row_version}; refresh page to pick up changes)</>
								)}
								{r.reason === 'validation' && <> {JSON.stringify(r.errors)}</>}
							</li>
						))}
					</ul>
				</details>
			)}

			<EbisuGrid<QapRow>
				ref={gridRef}
				rowData={rows}
				columnDefs={columnDefs}
				onDirtyChange={onDirtyChange}
				height="calc(100vh - 280px)"
			/>
		</>
	);
}
