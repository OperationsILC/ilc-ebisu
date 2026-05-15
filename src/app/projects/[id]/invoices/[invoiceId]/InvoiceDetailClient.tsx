'use client';

import { useMemo, useState, useTransition } from 'react';
import {
	addDeliveredLinesToInvoice,
	addFreeFormLineToInvoice,
	deleteInvoiceLine,
	markInvoiceSent,
	markInvoicePaid,
	applyCreditToInvoice,
	type DeliveredLineCandidate
} from '../actions';
import { updateInvoiceHeader, sendInvoiceEmail } from './actions';
import { SendPanel } from '@/app/components/SendPanel';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

type Invoice = {
	id: string;
	invoiceNo: string;
	type: string;
	status: string;
	designPhase: string | null;
	invoiceDate: string | null;
	dueDate: string | null;
	clientPoNo: string | null;
	salesTaxPct: string | null;
	salesTaxName: string | null;
	depositAppliedAmount: string | null;
	creditAppliedAmount: string | null;
	totalAmount: string | null;
	amountDue: string | null;
	paidAmount: string | null;
	sentAt: string | null;
	paidAt: string | null;
	qboStatus: string;
	createdAt: string;
	soNo: string | null;
	soId: string | null;
	clientCompany: string | null;
	creatorEmail: string | null;
};

type Line = {
	id: string;
	orderLineId: string | null;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	designFeeDescription: string | null;
	qtyInvoiced: string | null;
	qtyType: string | null;
	unitCnSnapshot: string | null;
	lineTotal: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	availableCredit: number;
	invoice: Invoice;
	lines: Line[];
	deliveredCandidates: DeliveredLineCandidate[];
};

function toDateInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toISOString().slice(0, 10);
}

export default function InvoiceDetailClient({
	projectId,
	projectName,
	availableCredit,
	invoice,
	lines,
	deliveredCandidates
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isDraft = invoice.status === 'draft';
	const isProduct = invoice.type === 'product';

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	// --- Add-from-delivered panel state ---
	const [picks, setPicks] = useState<Record<string, { selected: boolean; qty: string }>>(() =>
		Object.fromEntries(
			deliveredCandidates.map((c) => [
				c.shipmentLineId,
				{ selected: false, qty: String(c.qtyOpenToInvoice) }
			])
		)
	);

	function onAddDelivered() {
		const chosen = deliveredCandidates
			.filter((c) => picks[c.shipmentLineId]?.selected)
			.map((c) => ({
				orderLineId: c.orderLineId,
				shipmentLineId: c.shipmentLineId,
				qtyInvoiced: Number(picks[c.shipmentLineId]?.qty ?? c.qtyOpenToInvoice)
			}))
			.filter((p) => p.qtyInvoiced > 0);
		if (chosen.length === 0) {
			errorThen('Pick at least one line.');
			return;
		}
		startTransition(async () => {
			const r = await addDeliveredLinesToInvoice(invoice.id, chosen);
			if (r.error) errorThen(r.error);
			else {
				flashThen(`Added ${r.added} line${r.added === 1 ? '' : 's'}.`);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	// --- Free-form line state ---
	const [ffDescription, setFfDescription] = useState('');
	const [ffQty, setFfQty] = useState('1');
	const [ffUnitCn, setFfUnitCn] = useState('');

	function onAddFreeForm() {
		const q = Number(ffQty);
		const u = Number(ffUnitCn);
		if (!ffDescription.trim()) {
			errorThen('Description required.');
			return;
		}
		if (!Number.isFinite(q) || q <= 0) {
			errorThen('Qty must be > 0.');
			return;
		}
		if (!Number.isFinite(u) || u <= 0) {
			errorThen('Unit price must be > 0.');
			return;
		}
		startTransition(async () => {
			const r = await addFreeFormLineToInvoice(invoice.id, ffDescription, q, u);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Line added.');
				setFfDescription('');
				setFfQty('1');
				setFfUnitCn('');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onDeleteLine(lineId: string) {
		if (!confirm('Delete this line?')) return;
		startTransition(async () => {
			const r = await deleteInvoiceLine(invoice.id, lineId);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Line deleted.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onMarkSent() {
		if (lines.length === 0) {
			errorThen('Add at least one line before sending.');
			return;
		}
		if (!confirm(`Mark ${invoice.invoiceNo} as sent? Lines lock after this.`)) return;
		startTransition(async () => {
			const r = await markInvoiceSent(invoice.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Invoice marked sent.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const [payAmount, setPayAmount] = useState('');
	function onMarkPaid() {
		const n = Number(payAmount);
		if (!Number.isFinite(n) || n < 0) {
			errorThen('Payment amount must be ≥ 0.');
			return;
		}
		startTransition(async () => {
			const r = await markInvoicePaid(invoice.id, n);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Payment recorded.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const [creditApply, setCreditApply] = useState(invoice.creditAppliedAmount ?? '0');
	const [depositApply, setDepositApply] = useState(invoice.depositAppliedAmount ?? '0');
	function onApplyCredit() {
		const c = Number(creditApply);
		const d = Number(depositApply);
		if (!Number.isFinite(c) || c < 0 || !Number.isFinite(d) || d < 0) {
			errorThen('Amounts must be ≥ 0.');
			return;
		}
		if (c > availableCredit) {
			errorThen(`Credit applied exceeds available balance of ${usd.format(availableCredit)}.`);
			return;
		}
		startTransition(async () => {
			const r = await applyCreditToInvoice(invoice.id, c, d);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Applied.');
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const total = Number(invoice.totalAmount ?? 0);
	const due = Number(invoice.amountDue ?? 0);
	const credit = Number(invoice.creditAppliedAmount ?? 0);
	const deposit = Number(invoice.depositAppliedAmount ?? 0);
	const paid = Number(invoice.paidAmount ?? 0);
	const subtotal = useMemo(
		() => lines.reduce((s, l) => s + Number(l.lineTotal ?? 0), 0),
		[lines]
	);
	const taxPct = Number(invoice.salesTaxPct ?? 0);
	const taxAmt = isProduct ? subtotal * (taxPct / 100) : 0;

	const typeLabel =
		invoice.type === 'product'
			? 'Product invoice'
			: invoice.type === 'design_fee'
				? 'Design-fee invoice'
				: 'Credit memo';

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/invoices`}>← Invoices for {projectName}</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>{invoice.invoiceNo}</h1>
				<a
					href={`/projects/${projectId}/invoices/${invoice.id}/pdf`}
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px' }}
				>
					Download PDF ↗
				</a>
			</div>
			<p className="muted">
				<TypeBadge type={invoice.type} /> · <StatusBadge status={invoice.status} /> ·{' '}
				<QboBadge status={invoice.qboStatus} /> · {projectName}
				{invoice.soNo && (
					<>
						{' '}
						· SO <a href={`/projects/${projectId}/sos/${invoice.soId}`}>{invoice.soNo}</a>
					</>
				)}
				{invoice.clientCompany && <> · for {invoice.clientCompany}</>}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			{invoice.status !== 'void' && (
				<SendPanel
					docKindLabel={
						invoice.type === 'design_fee'
							? 'Design Fee Invoice'
							: invoice.type === 'credit_memo'
								? 'Credit Memo'
								: 'Invoice'
					}
					docNo={invoice.invoiceNo}
					defaultTo=""
					onSend={async (to) => {
						const r = await sendInvoiceEmail(projectId, invoice.id, to);
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
					disabled={lines.length === 0}
					disabledReason="add at least one line first"
				/>
			)}

			{/* === TOTALS PANEL === */}
			<h2 style={{ marginBottom: 4 }}>Totals</h2>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					gap: '8px',
					maxWidth: '900px',
					marginBottom: '16px'
				}}
			>
				<Stat label="Subtotal" value={usd.format(subtotal)} />
				{isProduct && (
					<Stat
						label={`Tax (${taxPct || 0}%)`}
						value={usd.format(taxAmt)}
						muted={taxAmt === 0}
					/>
				)}
				<Stat label="Total" value={usd.format(total)} />
				<Stat label="Deposit applied" value={usd.format(deposit)} muted={deposit === 0} />
				<Stat label="Credit applied" value={usd.format(credit)} muted={credit === 0} />
				<Stat label="Paid" value={usd.format(paid)} muted={paid === 0} />
				<Stat label="Amount due" value={usd.format(due)} highlight={due > 0} />
			</div>

			{/* === ACTIONS BAR === */}
			<div
				style={{
					display: 'flex',
					gap: '12px',
					margin: '12px 0',
					alignItems: 'center',
					flexWrap: 'wrap'
				}}
			>
				{isDraft && (
					<button className="primary" onClick={onMarkSent} disabled={pending}>
						Mark sent
					</button>
				)}
				{!isDraft && invoice.status !== 'paid' && invoice.status !== 'void' && (
					<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
						<label className="muted" style={{ fontSize: '11px' }}>
							Record payment $
						</label>
						<input
							type="number"
							step="0.01"
							value={payAmount}
							onChange={(e) => setPayAmount(e.target.value)}
							style={{ width: '110px' }}
						/>
						<button onClick={onMarkPaid} disabled={pending}>
							Apply
						</button>
					</div>
				)}
			</div>

			{/* === LINES === */}
			<h2>Lines ({lines.length})</h2>
			{lines.length === 0 ? (
				<p className="muted">No lines yet. {isProduct ? 'Pick from delivered items below.' : 'Add a line below.'}</p>
			) : (
				<table className="plain" style={{ fontSize: '12px', marginBottom: '16px' }}>
					<thead>
						<tr>
							{isProduct ? (
								<>
									<th>TYPE</th>
									<th>CATALOG #</th>
									<th>MANUFACTURER</th>
									<th>DESCRIPTION</th>
								</>
							) : (
								<th>DESCRIPTION</th>
							)}
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th>UoM</th>
							<th style={{ textAlign: 'right' }}>UNIT CN</th>
							<th style={{ textAlign: 'right' }}>LINE TOTAL</th>
							{isDraft && <th></th>}
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => (
							<tr key={l.id}>
								{isProduct ? (
									<>
										<td>{l.type ?? '—'}</td>
										<td>{l.catalogNo ?? '—'}</td>
										<td>{l.manufacturer ?? '—'}</td>
										<td className="muted">{l.description ?? '—'}</td>
									</>
								) : (
									<td>{l.designFeeDescription ?? l.description ?? '—'}</td>
								)}
								<td style={{ textAlign: 'right' }}>
									{Number(l.qtyInvoiced ?? 0).toLocaleString()}
								</td>
								<td>{l.qtyType ?? ''}</td>
								<td style={{ textAlign: 'right' }}>
									{l.unitCnSnapshot ? usd.format(Number(l.unitCnSnapshot)) : '—'}
								</td>
								<td style={{ textAlign: 'right' }}>
									{l.lineTotal ? usd.format(Number(l.lineTotal)) : '—'}
								</td>
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
						))}
					</tbody>
				</table>
			)}

			{/* === ADD-FROM-DELIVERED (product, draft) === */}
			{isDraft && isProduct && (
				<>
					<h2 style={{ marginTop: '24px' }}>Delivered & uninvoiced ({deliveredCandidates.length})</h2>
					{deliveredCandidates.length === 0 ? (
						<p className="muted">
							No delivered-but-uninvoiced items on this SO. Mark shipments received first.
						</p>
					) : (
						<>
							<table className="plain" style={{ fontSize: '12px' }}>
								<thead>
									<tr>
										<th></th>
										<th>SHIPMENT</th>
										<th>RECEIVED</th>
										<th>TYPE</th>
										<th>CATALOG #</th>
										<th>MANUFACTURER</th>
										<th style={{ textAlign: 'right' }}>DELIVERED</th>
										<th style={{ textAlign: 'right' }}>ALREADY INVOICED</th>
										<th style={{ textAlign: 'right' }}>OPEN</th>
										<th style={{ textAlign: 'right' }}>BILL QTY</th>
										<th style={{ textAlign: 'right' }}>UNIT CN</th>
									</tr>
								</thead>
								<tbody>
									{deliveredCandidates.map((c) => {
										const p = picks[c.shipmentLineId];
										return (
											<tr key={c.shipmentLineId}>
												<td>
													<input
														type="checkbox"
														checked={p?.selected ?? false}
														onChange={(e) =>
															setPicks({
																...picks,
																[c.shipmentLineId]: {
																	selected: e.target.checked,
																	qty: p?.qty ?? String(c.qtyOpenToInvoice)
																}
															})
														}
													/>
												</td>
												<td>{c.shipmentNo}</td>
												<td className="muted">
													{c.shipmentReceivedDate
														? new Date(c.shipmentReceivedDate).toLocaleDateString()
														: '—'}
												</td>
												<td>{c.type ?? '—'}</td>
												<td>{c.catalogNo ?? '—'}</td>
												<td>{c.manufacturer ?? '—'}</td>
												<td style={{ textAlign: 'right' }}>
													{c.qtyDelivered.toLocaleString()}
												</td>
												<td style={{ textAlign: 'right' }} className="muted">
													{c.qtyAlreadyInvoiced.toLocaleString()}
												</td>
												<td style={{ textAlign: 'right' }}>
													<strong>{c.qtyOpenToInvoice.toLocaleString()}</strong>
												</td>
												<td style={{ textAlign: 'right' }}>
													<input
														type="number"
														step="0.01"
														value={p?.qty ?? String(c.qtyOpenToInvoice)}
														onChange={(e) =>
															setPicks({
																...picks,
																[c.shipmentLineId]: {
																	selected: p?.selected ?? false,
																	qty: e.target.value
																}
															})
														}
														style={{ width: '70px', textAlign: 'right' }}
													/>
												</td>
												<td style={{ textAlign: 'right' }}>
													{c.unitCn ? usd.format(Number(c.unitCn)) : '—'}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
							<div style={{ margin: '12px 0' }}>
								<button className="primary" onClick={onAddDelivered} disabled={pending}>
									Add selected to invoice
								</button>
							</div>
						</>
					)}
				</>
			)}

			{/* === ADD FREE-FORM LINE (design-fee / credit-memo, draft) === */}
			{isDraft && !isProduct && (
				<>
					<h2 style={{ marginTop: '24px' }}>Add line</h2>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: '3fr 1fr 1fr auto',
							gap: '8px',
							maxWidth: '900px',
							alignItems: 'end'
						}}
					>
						<label>
							Description
							<input
								type="text"
								value={ffDescription}
								onChange={(e) => setFfDescription(e.target.value)}
								placeholder={
									invoice.type === 'design_fee'
										? 'e.g. 50% Schematic Design'
										: 'e.g. Credit for damaged fixtures'
								}
								style={{ width: '100%' }}
							/>
						</label>
						<label>
							Qty
							<input
								type="number"
								step="0.01"
								value={ffQty}
								onChange={(e) => setFfQty(e.target.value)}
								style={{ width: '100%' }}
							/>
						</label>
						<label>
							Unit $
							<input
								type="number"
								step="0.01"
								value={ffUnitCn}
								onChange={(e) => setFfUnitCn(e.target.value)}
								style={{ width: '100%' }}
							/>
						</label>
						<button className="primary" onClick={onAddFreeForm} disabled={pending}>
							+ Add line
						</button>
					</div>
				</>
			)}

			{/* === CREDIT / DEPOSIT APPLICATION === */}
			{(isDraft || invoice.status === 'sent') && (
				<div
					style={{
						marginTop: '32px',
						padding: '12px',
						background: '#fafafa',
						border: '1px solid #ddd',
						borderRadius: '4px',
						maxWidth: '700px'
					}}
				>
					<h3 style={{ marginTop: 0 }}>Apply credit / deposit</h3>
					<p className="muted" style={{ fontSize: '12px' }}>
						Client&apos;s available credit balance:{' '}
						<strong>{usd.format(availableCredit)}</strong>. Deposits are funds the client paid
						ahead specifically for this project.
					</p>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: '1fr 1fr auto',
							gap: '8px',
							alignItems: 'end'
						}}
					>
						<label>
							Credit to apply $
							<input
								type="number"
								step="0.01"
								value={creditApply}
								onChange={(e) => setCreditApply(e.target.value)}
								style={{ width: '100%' }}
							/>
						</label>
						<label>
							Deposit to apply $
							<input
								type="number"
								step="0.01"
								value={depositApply}
								onChange={(e) => setDepositApply(e.target.value)}
								style={{ width: '100%' }}
							/>
						</label>
						<button onClick={onApplyCredit} disabled={pending}>
							Apply
						</button>
					</div>
				</div>
			)}

			{/* === HEADER FORM === */}
			<h2 style={{ marginTop: '32px' }}>Invoice details</h2>
			<HeaderForm projectId={projectId} invoice={invoice} disabled={!isDraft} />
		</>
	);
}

function HeaderForm({
	projectId,
	invoice,
	disabled
}: {
	projectId: string;
	invoice: Invoice;
	disabled: boolean;
}) {
	const action = updateInvoiceHeader.bind(null, projectId, invoice.id);

	return (
		<form action={action} style={{ maxWidth: '900px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
				<label>
					Invoice date
					<input
						name="invoiceDate"
						type="date"
						defaultValue={toDateInput(invoice.invoiceDate)}
						disabled={disabled}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Due date
					<input
						name="dueDate"
						type="date"
						defaultValue={toDateInput(invoice.dueDate)}
						disabled={disabled}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Client PO # (this invoice)
					<input
						name="clientPoNo"
						type="text"
						defaultValue={invoice.clientPoNo ?? ''}
						disabled={disabled}
						style={{ width: '100%' }}
					/>
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginTop: '12px' }}>
				<label>
					Sales tax %
					<input
						name="salesTaxPct"
						type="number"
						step="0.001"
						defaultValue={invoice.salesTaxPct ?? ''}
						disabled={disabled || invoice.type !== 'product'}
						style={{ width: '100%' }}
					/>
				</label>
				<label>
					Sales tax label
					<input
						name="salesTaxName"
						type="text"
						defaultValue={invoice.salesTaxName ?? ''}
						placeholder="e.g. 2.9% — CO STATE"
						disabled={disabled || invoice.type !== 'product'}
						style={{ width: '100%' }}
					/>
				</label>
			</div>
			{invoice.type === 'design_fee' && (
				<label style={{ display: 'block', marginTop: '12px' }}>
					Design phase
					<input
						name="designPhase"
						type="text"
						defaultValue={invoice.designPhase ?? ''}
						placeholder="e.g. 100% SCHEMATIC DESIGN"
						disabled={disabled}
						style={{ width: '100%' }}
					/>
				</label>
			)}
			{!disabled && (
				<div style={{ marginTop: '12px' }}>
					<button className="primary" type="submit">
						Save details
					</button>
				</div>
			)}
		</form>
	);
}

function Stat({
	label,
	value,
	muted,
	highlight
}: {
	label: string;
	value: string;
	muted?: boolean;
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
					color: muted ? '#999' : highlight ? '#c00' : '#111'
				}}
			>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		partial_paid: { bg: '#cfe9ff', fg: '#0a3a6e' },
		paid: { bg: '#d4edda', fg: '#155724' },
		past_due: { bg: '#f5d6d6', fg: '#7a1212' },
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

function TypeBadge({ type }: { type: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		product: { bg: '#eef6ff', fg: '#234' },
		design_fee: { bg: '#fff3e0', fg: '#7a4500' },
		credit_memo: { bg: '#fce4ec', fg: '#7a1212' }
	};
	const labels: Record<string, string> = {
		product: 'PRODUCT',
		design_fee: 'DESIGN FEE',
		credit_memo: 'CREDIT'
	};
	const c = colors[type] ?? { bg: '#eee', fg: '#333' };
	return (
		<span
			style={{
				background: c.bg,
				color: c.fg,
				padding: '2px 6px',
				borderRadius: '3px',
				fontSize: '10px',
				fontWeight: 600
			}}
		>
			{labels[type] ?? type}
		</span>
	);
}

function QboBadge({ status }: { status: string }) {
	if (status === 'pushed') return <span style={{ color: '#0a7c2f', fontSize: '11px' }}>● QBO</span>;
	if (status === 'failed') return <span style={{ color: '#c00', fontSize: '11px' }}>● QBO failed</span>;
	if (status === 'queued') return <span style={{ color: '#7a5d00', fontSize: '11px' }}>● QBO queued</span>;
	return <span className="muted" style={{ fontSize: '11px' }}>○ not pushed</span>;
}
