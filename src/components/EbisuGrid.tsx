'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
	ModuleRegistry,
	AllCommunityModule,
	themeQuartz,
	type ColDef,
	type CellValueChangedEvent
} from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export type DirtyCells = Record<string, unknown>;

export type EbisuGridHandle = {
	getDirty: () => Map<string, DirtyCells>;
	clearDirty: () => void;
};

type Props<TRow extends { id: string }> = {
	rowData: TRow[];
	columnDefs: ColDef<TRow>[];
	onDirtyChange?: (dirty: Map<string, DirtyCells>) => void;
	height?: string;
};

function EbisuGridInner<TRow extends { id: string }>(
	{ rowData, columnDefs, onDirtyChange, height = '600px' }: Props<TRow>,
	ref: React.Ref<EbisuGridHandle>
) {
	const dirty = useRef(new Map<string, DirtyCells>());
	const onDirtyChangeRef = useRef(onDirtyChange);

	useEffect(() => {
		onDirtyChangeRef.current = onDirtyChange;
	}, [onDirtyChange]);

	useImperativeHandle(ref, () => ({
		getDirty: () => dirty.current,
		clearDirty: () => {
			dirty.current = new Map();
			onDirtyChangeRef.current?.(dirty.current);
		}
	}));

	function handleCellValueChanged(ev: CellValueChangedEvent<TRow>) {
		const id = ev.data?.id;
		if (!id) return;
		const colKey = ev.colDef.field;
		if (!colKey) return;

		const existing = dirty.current.get(id) ?? {};
		existing[colKey] = ev.newValue;
		dirty.current.set(id, existing);
		onDirtyChangeRef.current?.(dirty.current);
	}

	return (
		<div style={{ height, width: '100%' }}>
			<AgGridReact<TRow>
				theme={themeQuartz}
				rowData={rowData}
				columnDefs={columnDefs}
				defaultColDef={{
					editable: true,
					resizable: true,
					sortable: true,
					filter: true,
					minWidth: 90
				}}
				getRowId={(params) => params.data.id}
				onCellValueChanged={handleCellValueChanged}
				animateRows={false}
				rowSelection={{ mode: 'multiRow', headerCheckbox: false }}
			/>
		</div>
	);
}

const EbisuGrid = forwardRef(EbisuGridInner) as <TRow extends { id: string }>(
	props: Props<TRow> & { ref?: React.Ref<EbisuGridHandle> }
) => React.ReactElement;

export default EbisuGrid;
