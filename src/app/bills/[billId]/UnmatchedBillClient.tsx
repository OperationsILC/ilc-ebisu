'use client';

import { useState, useTransition } from 'react';
import { attachBillToPo } from '../../projects/[id]/bills/actions';

type Props = {
	bill: {
		id: string;
		billNo: string;
		vendorBillNo: string | null;
		totalAmount: string | null;
		sourcePdfUrl: string | null;
		sourceParsedJson: Record<string, unknown> | null;
	};
	poOptions: { id: string; poNo: string }[];
};

export default function UnmatchedBillClient({ bill, poOptions }: Props) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [poNumber, setPoNumber] = useState('');

	function onAttach() {
		// First arg is a project id, but the server action looks up the project
		// from the PO and updates the bill's project_id. Pass empty string —
		// the server action ignores it for this call path.
		startTransition(async () => {
			const r = await attachBillToPo('', bill.id, poNumber);
			if (r.error) setError(r.error);
			else {
				// The server action sets project_id; next load will redirect.
				window.location.href = `/bills/${bill.id}`;
			}
		});
	}

	return (
		<>
			<p>
				<a href="/bills">← Bills inbox</a>
			</p>

			<h1>{bill.billNo} (unmatched)</h1>
			<p className="muted">
				This bill arrived without a PO match. Enter the PO number from the bill to attach it
				and unlock the review workflow.
				{bill.vendorBillNo && (
					<>
						{' '}
						· vendor bill <strong>{bill.vendorBillNo}</strong>
					</>
				)}
				{bill.totalAmount && (
					<> · total ${Number(bill.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
				)}
			</p>

			{error && <p className="flash error">{error}</p>}

			<div
				style={{
					padding: '12px',
					background: '#fff5e0',
					border: '1px solid #e0c890',
					borderRadius: '4px',
					maxWidth: '700px',
					marginBottom: '16px'
				}}
			>
				<strong>Attach to PO</strong>
				<div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
					<input
						type="text"
						value={poNumber}
						onChange={(e) => setPoNumber(e.target.value)}
						list="po-options"
						placeholder="e.g. PO00123"
						style={{ width: '200px' }}
					/>
					<datalist id="po-options">
						{poOptions.map((p) => (
							<option key={p.id} value={p.poNo} />
						))}
					</datalist>
					<button className="primary" onClick={onAttach} disabled={pending || !poNumber.trim()}>
						Attach
					</button>
				</div>
			</div>

			{bill.sourcePdfUrl && (
				<p>
					<a href={bill.sourcePdfUrl} target="_blank" rel="noopener">
						View original bill PDF ↗
					</a>
				</p>
			)}

			{bill.sourceParsedJson && (
				<details style={{ marginTop: '12px' }}>
					<summary className="muted" style={{ cursor: 'pointer', fontSize: '12px' }}>
						DocParser raw extraction (audit)
					</summary>
					<pre
						style={{
							fontSize: '11px',
							background: '#fafafa',
							padding: '8px',
							marginTop: '8px',
							border: '1px solid #ddd',
							borderRadius: '4px',
							overflow: 'auto',
							maxWidth: '900px'
						}}
					>
						{JSON.stringify(bill.sourceParsedJson, null, 2)}
					</pre>
				</details>
			)}
		</>
	);
}
