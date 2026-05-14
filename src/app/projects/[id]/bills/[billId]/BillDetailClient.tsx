'use client';

import { useState, useTransition } from 'react';
import {
	updateBillHeader,
	approveBill,
	rejectBill,
	attachBillToPo,
	upsertBillLine,
	deleteBillLine
} from '../actions';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

type Bill = {
	id: string;
	billNo: string;
	vendorBillNo: string | null;
	status: string;
	billDate: string | null;
	dueDate: string | null;
	totalAmount: string | null;
	paidAmount: string | null;
	notes: string | null;
	sourcePdfUrl: string | null;
	sourceParsedJson: Record<string, unknown> | null;
	approvedAt: string | null;
	rejectedAt: string | null;
	rejectedReason: string | null;
	qboStatus: string;
	createdAt: string;
	vendor: string | null;
	poId: string | null;
	poNo: string | null;
	poStatus: string | null;
	approverEmail: string | null;
};

type Line = {
	id: string;
	orderLineId: string | null;
	descriptionText: string | null;
	catalogNoText: string | null;
	qty: string | null;
	unitPrice: string | null;
	lineTotal: string | null;
	notes: string | null;
};

type PoLine = {
	id: string;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	unitDn: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	bill: Bill;
	lines: Line[];
	poLines: PoLine[];
	linesTotal: number;
	linesCount: number;
};

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

export default function BillDetailClient({
	projectId,
	projectName,
	bill,
	lines,
	poLines,
	linesTotal,
	linesCount
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isPending = bill.status === 'pending_review';

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	const [poLookup, setPoLookup] = useState(bill.poNo ?? '');
	function onAttachPo() {
		startTransition(async () => {
			const r = await attachBillToPo(projectId, bill.id, poLookup);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Attached.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onApprove() {
		if (!confirm(`Approve ${bill.billNo}? It will queue for QBO push.`)) return;
		startTransition(async () => {
			const r = await approveBill(projectId, bill.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Approved.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const [rejectReason, setRejectReason] = useState('');
	const [showReject, setShowReject] = useState(false);
	function onReject() {
		if (!rejectReason.trim()) {
			errorThen('Provide a reject reason.');
			return;
		}
		startTransition(async () => {
			const r = await rejectBill(projectId, bill.id, rejectReason);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Rejected.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const totalAmount = Number(bill.totalAmount ?? 0);
	const reconcileDiff = totalAmount - linesTotal;
	const reconcileOff = Math.abs(reconcileDiff) > 0.01;

	const headerAction = updateBillHeader.bind(null, projectId, bill.id);
	const lineUpsertAction = async (formData: FormData) => {
		const r = await upsertBillLine(projectId, bill.id, formData);
		if (r.error) errorThen(r.error);
	};

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/bills`}>← Bills for {projectName}</a>
			</p>

			<h1>
				{bill.billNo}
				{bill.vendor && <span className="muted"> · from {bill.vendor}</span>}
			</h1>
			<p className="muted">
				<StatusBadge status={bill.status} /> · <QboBadge status={bill.qboStatus} />
				{bill.vendorBillNo && (
					<>
						{' '}
						· vendor bill <strong>{bill.vendorBillNo}</strong>
					</>
				)}
				{bill.approvedAt && bill.approverEmail && (
					<>
						{' '}
						· approved by {bill.approverEmail} on{' '}
						{new Date(bill.approvedAt).toLocaleDateString()}
					</>
				)}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			{bill.status === 'rejected' && bill.rejectedReason && (
				<p className="flash error">
					<strong>Rejected:</strong> {bill.rejectedReason}
				</p>
			)}

			{/* === PO ATTACHMENT BLOCK === */}
			<div
				style={{
					padding: '12px',
					background: bill.poNo ? '#f0f8f0' : '#fff5e0',
					border: `1px solid ${bill.poNo ? '#cce0cc' : '#e0c890'}`,
					borderRadius: '4px',
					marginBottom: '16px'
				}}
			>
				{bill.poNo ? (
					<>
						<strong>Attached to PO:</strong>{' '}
						<a href={`/projects/${projectId}/pos/${bill.poId}`}>{bill.poNo}</a>{' '}
						<span className="muted">({bill.poStatus})</span>
					</>
				) : (
					<>
						<strong>No PO attached yet.</strong> Bills must be linked to a PO before approval.
					</>
				)}
				{isPending && (
					<div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
						<input
							type="text"
							value={poLookup}
							onChange={(e) => setPoLookup(e.target.value)}
							placeholder="e.g. PO00123"
							style={{ width: '160px' }}
						/>
						<button onClick={onAttachPo} disabled={pending}>
							Attach
						</button>
					</div>
				)}
			</div>

			{/* === RECONCILE WARNING === */}
			{reconcileOff && linesCount > 0 && (
				<p className="flash info">
					<strong>Reconciliation off by {usd.format(Math.abs(reconcileDiff))}.</strong> Bill
					total is {usd.format(totalAmount)} but the sum of {linesCount} line
					{linesCount === 1 ? '' : 's'} is {usd.format(linesTotal)}.
				</p>
			)}

			{/* === ACTION BUTTONS === */}
			{isPending && (
				<div style={{ display: 'flex', gap: '12px', margin: '12px 0', flexWrap: 'wrap' }}>
					<button className="primary" onClick={onApprove} disabled={pending || !bill.poId}>
						Approve bill {bill.poId ? '' : '(attach PO first)'}
					</button>
					<button onClick={() => setShowReject(!showReject)} disabled={pending}>
						{showReject ? 'Cancel reject' : 'Reject bill'}
					</button>
				</div>
			)}
			{showReject && (
				<div style={{ display: 'flex', gap: '6px', margin: '8px 0', alignItems: 'center' }}>
					<input
						type="text"
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						placeholder="Reason (required)"
						style={{ width: '320px' }}
					/>
					<button onClick={onReject} disabled={pending}>
						Confirm reject
					</button>
				</div>
			)}

			{/* === LINES === */}
			<h2>Lines ({lines.length})</h2>
			{lines.length === 0 ? (
				<p className="muted">No lines extracted/entered yet.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px', maxWidth: '1100px' }}>
					<thead>
						<tr>
							<th>CATALOG #</th>
							<th>DESCRIPTION</th>
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th style={{ textAlign: 'right' }}>UNIT</th>
							<th style={{ textAlign: 'right' }}>TOTAL</th>
							{isPending && <th></th>}
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => (
							<tr key={l.id}>
								<td>{l.catalogNoText ?? '—'}</td>
								<td className="muted">{l.descriptionText ?? '—'}</td>
								<td style={{ textAlign: 'right' }}>{l.qty ? Number(l.qty).toLocaleString() : '—'}</td>
								<td style={{ textAlign: 'right' }}>
									{l.unitPrice ? usd.format(Number(l.unitPrice)) : '—'}
								</td>
								<td style={{ textAlign: 'right' }}>
									{l.lineTotal ? usd.format(Number(l.lineTotal)) : '—'}
								</td>
								{isPending && (
									<td>
										<form
											action={async () => {
												await deleteBillLine(projectId, bill.id, l.id);
												window.location.reload();
											}}
										>
											<button
												type="submit"
												disabled={pending}
												style={{ fontSize: '11px' }}
											>
												×
											</button>
										</form>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			)}

			{/* === ADD-LINE FORM (when pending review) === */}
			{isPending && (
				<>
					<h3 style={{ marginTop: '20px' }}>Add a line</h3>
					<form action={lineUpsertAction}>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: '1fr 2fr 0.7fr 0.8fr auto',
								gap: '8px',
								maxWidth: '1000px',
								alignItems: 'end'
							}}
						>
							<label>
								Catalog #
								<input name="catalogNo" type="text" style={{ width: '100%' }} />
							</label>
							<label>
								Description
								<input name="description" type="text" style={{ width: '100%' }} />
							</label>
							<label>
								Qty
								<input name="qty" type="number" step="0.01" style={{ width: '100%' }} />
							</label>
							<label>
								Unit $
								<input name="unitPrice" type="number" step="0.01" style={{ width: '100%' }} />
							</label>
							<button className="primary" type="submit" disabled={pending}>
								+ Add
							</button>
						</div>
					</form>
				</>
			)}

			{/* === PO LINES REFERENCE (read-only) === */}
			{poLines.length > 0 && (
				<>
					<h2 style={{ marginTop: '32px' }}>For reference: what&apos;s on PO {bill.poNo}</h2>
					<p className="muted" style={{ fontSize: '12px' }}>
						Compare the bill above to the PO below. PMs typically verify the catalog
						numbers and qty match.
					</p>
					<table className="plain" style={{ fontSize: '12px', maxWidth: '1100px' }}>
						<thead>
							<tr>
								<th>TYPE</th>
								<th>CATALOG #</th>
								<th>MANUFACTURER</th>
								<th>DESCRIPTION</th>
								<th style={{ textAlign: 'right' }}>QTY</th>
								<th style={{ textAlign: 'right' }}>UNIT DN</th>
							</tr>
						</thead>
						<tbody>
							{poLines.map((p) => (
								<tr key={p.id}>
									<td>{p.type ?? '—'}</td>
									<td>{p.catalogNo ?? '—'}</td>
									<td>{p.manufacturer ?? '—'}</td>
									<td className="muted">{p.description ?? '—'}</td>
									<td style={{ textAlign: 'right' }}>
										{p.qty ? Number(p.qty).toLocaleString() : '—'}
									</td>
									<td style={{ textAlign: 'right' }}>
										{p.unitDn ? usd.format(Number(p.unitDn)) : '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}

			{/* === HEADER FORM === */}
			<h2 style={{ marginTop: '32px' }}>Bill details</h2>
			<form action={headerAction} style={{ maxWidth: '900px' }}>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
					<label>
						Vendor bill #
						<input
							name="vendorBillNo"
							type="text"
							defaultValue={bill.vendorBillNo ?? ''}
							disabled={!isPending}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Bill date
						<input
							name="billDate"
							type="date"
							defaultValue={toDateInput(bill.billDate)}
							disabled={!isPending}
							style={{ width: '100%' }}
						/>
					</label>
					<label>
						Due date
						<input
							name="dueDate"
							type="date"
							defaultValue={toDateInput(bill.dueDate)}
							disabled={!isPending}
							style={{ width: '100%' }}
						/>
					</label>
				</div>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Total amount $
					<input
						name="totalAmount"
						type="number"
						step="0.01"
						defaultValue={bill.totalAmount ?? ''}
						disabled={!isPending}
						style={{ width: '200px' }}
					/>
				</label>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Internal notes (never leaves Ebisu)
					<textarea
						name="notes"
						rows={2}
						defaultValue={bill.notes ?? ''}
						disabled={!isPending}
						style={{ width: '100%' }}
					/>
				</label>
				{isPending && (
					<div style={{ marginTop: '12px' }}>
						<button className="primary" type="submit">
							Save details
						</button>
					</div>
				)}
			</form>

			{bill.sourcePdfUrl && (
				<p style={{ marginTop: '24px' }}>
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
							overflow: 'auto'
						}}
					>
						{JSON.stringify(bill.sourceParsedJson, null, 2)}
					</pre>
				</details>
			)}
		</>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		pending_review: { bg: '#fff3cd', fg: '#7a5d00' },
		approved: { bg: '#d4edda', fg: '#155724' },
		scheduled: { bg: '#cfe9ff', fg: '#0a3a6e' },
		paid: { bg: '#d4edda', fg: '#155724' },
		rejected: { bg: '#f5d6d6', fg: '#7a1212' },
		void: { bg: '#eee', fg: '#666' }
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
			{status.replace('_', ' ')}
		</span>
	);
}

function QboBadge({ status }: { status: string }) {
	if (status === 'pushed') return <span style={{ color: '#0a7c2f', fontSize: '11px' }}>● QBO</span>;
	if (status === 'failed') return <span style={{ color: '#c00', fontSize: '11px' }}>● failed</span>;
	if (status === 'queued') return <span style={{ color: '#7a5d00', fontSize: '11px' }}>● queued</span>;
	return <span className="muted" style={{ fontSize: '11px' }}>○ not pushed</span>;
}
