'use client';

import { useState, useTransition } from 'react';
import {
	updateChangeOrderHeader,
	addModifyLineToCo,
	addRemoveLineToCo,
	addNewLineToCo,
	deleteCoLine,
	markChangeOrderSent,
	markChangeOrderAcknowledged,
	applyChangeOrder,
	rejectChangeOrder,
	cancelChangeOrder
} from '../actions';

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

type Co = {
	id: string;
	coNo: string;
	status: string;
	versionNoBefore: number;
	versionNoAfter: number | null;
	description: string | null;
	reason: string | null;
	customEmailMessage: string | null;
	netAmountChange: string | null;
	sentAt: string | null;
	acknowledgedAt: string | null;
	appliedAt: string | null;
	rejectedAt: string | null;
	rejectedReason: string | null;
	createdAt: string;
	creatorEmail: string | null;
	applierEmail: string | null;
};

type CoLine = {
	id: string;
	operation: string;
	orderLineId: string | null;
	typeBefore: string | null;
	catalogNoBefore: string | null;
	manufacturerBefore: string | null;
	descriptionBefore: string | null;
	qtyBefore: string | null;
	qtyTypeBefore: string | null;
	unitDnBefore: string | null;
	typeAfter: string | null;
	catalogNoAfter: string | null;
	manufacturerAfter: string | null;
	descriptionAfter: string | null;
	qtyAfter: string | null;
	qtyTypeAfter: string | null;
	unitDnAfter: string | null;
	lineTotalDelta: string | null;
	reasonText: string | null;
};

type PoLineOption = {
	id: string;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
	unitDn: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	poId: string;
	poNo: string;
	poStatus: string;
	poVersionNo: number;
	repFirm: string | null;
	co: Co;
	lines: CoLine[];
	eligiblePoLines: PoLineOption[];
};

export default function ChangeOrderDetailClient({
	projectId,
	projectName,
	poId,
	poNo,
	poVersionNo,
	repFirm,
	co,
	lines,
	eligiblePoLines
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isDraft = co.status === 'draft';
	const canApply = ['draft', 'sent', 'acknowledged'].includes(co.status);

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	const headerAction = updateChangeOrderHeader.bind(null, projectId, poId, co.id);
	const modifyAction = async (formData: FormData) => {
		const r = await addModifyLineToCo(projectId, poId, co.id, formData);
		if (r.error) errorThen(r.error);
		else {
			flashThen('Modification added.');
			setTimeout(() => window.location.reload(), 400);
		}
	};
	const addAction = async (formData: FormData) => {
		const r = await addNewLineToCo(projectId, poId, co.id, formData);
		if (r.error) errorThen(r.error);
		else {
			flashThen('New line added.');
			setTimeout(() => window.location.reload(), 400);
		}
	};

	function onDeleteCoLine(lineId: string) {
		if (!confirm('Remove this CO line?')) return;
		startTransition(async () => {
			const r = await deleteCoLine(projectId, poId, co.id, lineId);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Removed.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onRemoveLine(orderLineId: string) {
		const reason = prompt('Why are you removing this line from the PO?') ?? '';
		if (!reason.trim()) return;
		startTransition(async () => {
			const r = await addRemoveLineToCo(projectId, poId, co.id, orderLineId, reason);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Line marked for removal.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onMarkSent() {
		if (!confirm(`Mark ${co.coNo} as sent? Lines lock.`)) return;
		startTransition(async () => {
			const r = await markChangeOrderSent(projectId, poId, co.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Sent.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onMarkAcked() {
		startTransition(async () => {
			const r = await markChangeOrderAcknowledged(projectId, poId, co.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Acknowledged.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onApply() {
		if (
			!confirm(
				`Apply ${co.coNo}? This mutates the PO's order lines and bumps version v${poVersionNo} → v${poVersionNo + 1}. Irreversible.`
			)
		)
			return;
		startTransition(async () => {
			const r = await applyChangeOrder(projectId, poId, co.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Applied.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	const [rejectReason, setRejectReason] = useState('');
	const [showReject, setShowReject] = useState(false);
	function onReject() {
		if (!rejectReason.trim()) {
			errorThen('Reason required.');
			return;
		}
		startTransition(async () => {
			const r = await rejectChangeOrder(projectId, poId, co.id, rejectReason);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Rejected.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	function onCancel() {
		if (!confirm('Cancel this CO?')) return;
		startTransition(async () => {
			const r = await cancelChangeOrder(projectId, poId, co.id);
			if (r.error) errorThen(r.error);
			else {
				flashThen('Cancelled.');
				setTimeout(() => window.location.reload(), 400);
			}
		});
	}

	const netChange = Number(co.netAmountChange ?? 0);

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/pos/${poId}/change-orders`}>
					← Change Orders for {poNo}
				</a>
			</p>

			<div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
				<h1 style={{ margin: 0 }}>{co.coNo}</h1>
				<a
					href={`/projects/${projectId}/pos/${poId}/change-orders/${co.id}/pdf`}
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px' }}
				>
					Download PDF ↗
				</a>
			</div>
			<p className="muted">
				<StatusBadge status={co.status} /> · PO {poNo} {repFirm && `(${repFirm})`}
				 · amending v{co.versionNoBefore}
				{co.versionNoAfter && ` → v${co.versionNoAfter}`}
				{co.appliedAt && (
					<>
						{' '}
						· applied {new Date(co.appliedAt).toLocaleDateString()} by {co.applierEmail}
					</>
				)}
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}
			{co.status === 'rejected' && co.rejectedReason && (
				<p className="flash error">
					<strong>Rejected:</strong> {co.rejectedReason}
				</p>
			)}

			{/* === SUMMARY === */}
			<div
				style={{
					padding: '12px',
					background: '#fff',
					border: '1px solid #ddd',
					borderRadius: '4px',
					marginBottom: '16px',
					maxWidth: '700px'
				}}
			>
				<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
					Net change to PO total
				</div>
				<div
					style={{
						fontSize: '24px',
						fontWeight: 600,
						color: netChange > 0 ? '#7a1212' : netChange < 0 ? '#0a7c2f' : '#111'
					}}
				>
					{netChange > 0 ? '+' : ''}
					{usd.format(netChange)}
				</div>
			</div>

			{/* === ACTIONS === */}
			<div style={{ display: 'flex', gap: '12px', margin: '12px 0', flexWrap: 'wrap' }}>
				{isDraft && (
					<button className="primary" onClick={onMarkSent} disabled={pending}>
						Mark sent
					</button>
				)}
				{co.status === 'sent' && (
					<button onClick={onMarkAcked} disabled={pending}>
						Mark acknowledged
					</button>
				)}
				{canApply && (
					<button className="primary" onClick={onApply} disabled={pending}>
						Apply to PO →
					</button>
				)}
				{co.status !== 'applied' && co.status !== 'rejected' && co.status !== 'cancelled' && (
					<>
						<button onClick={() => setShowReject(!showReject)} disabled={pending}>
							{showReject ? 'Cancel reject' : 'Reject'}
						</button>
						<button onClick={onCancel} disabled={pending}>
							Cancel CO
						</button>
					</>
				)}
			</div>
			{showReject && (
				<div style={{ display: 'flex', gap: '6px', margin: '8px 0', alignItems: 'center' }}>
					<input
						type="text"
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						placeholder="Reject reason (required)"
						style={{ width: '360px' }}
					/>
					<button onClick={onReject} disabled={pending}>
						Confirm reject
					</button>
				</div>
			)}

			{/* === HEADER FORM === */}
			<h2>Description &amp; reason</h2>
			<form action={headerAction} style={{ maxWidth: '900px' }}>
				<label style={{ display: 'block' }}>
					Description (why does this CO exist?)
					<textarea
						name="description"
						rows={2}
						defaultValue={co.description ?? ''}
						disabled={!isDraft}
						placeholder="e.g. Manufacturer raised price on the C-X line; client added bathroom sconces."
						style={{ width: '100%' }}
					/>
				</label>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '12px' }}>
					<label>
						Reason category (optional)
						<select name="reason" defaultValue={co.reason ?? ''} disabled={!isDraft} style={{ width: '300px' }}>
							<option value="">—</option>
							<option value="add_lines">Add lines</option>
							<option value="remove_lines">Remove lines</option>
							<option value="qty_change">Qty change</option>
							<option value="price_change">Price change</option>
							<option value="spec_change">Spec change</option>
							<option value="other">Other</option>
						</select>
					</label>
				</div>
				<label style={{ display: 'block', marginTop: '12px' }}>
					Custom email message (for the rep)
					<textarea
						name="customEmailMessage"
						rows={2}
						defaultValue={co.customEmailMessage ?? ''}
						disabled={!isDraft}
						style={{ width: '100%' }}
					/>
				</label>
				{isDraft && (
					<div style={{ marginTop: '12px' }}>
						<button className="primary" type="submit">
							Save details
						</button>
					</div>
				)}
			</form>

			{/* === CO LINES === */}
			<h2 style={{ marginTop: '24px' }}>Changes ({lines.length})</h2>
			{lines.length === 0 ? (
				<p className="muted">No changes yet. Use the tools below to add modifications.</p>
			) : (
				<table className="plain" style={{ fontSize: '12px', maxWidth: '1300px' }}>
					<thead>
						<tr>
							<th>Op</th>
							<th>Catalog #</th>
							<th>Manufacturer</th>
							<th>Description</th>
							<th style={{ textAlign: 'right' }}>Qty before → after</th>
							<th style={{ textAlign: 'right' }}>Unit DN before → after</th>
							<th style={{ textAlign: 'right' }}>Δ $</th>
							<th>Reason</th>
							{isDraft && <th></th>}
						</tr>
					</thead>
					<tbody>
						{lines.map((l) => (
							<tr key={l.id}>
								<td>
									<OpBadge op={l.operation} />
								</td>
								<td>
									<DiffCell before={l.catalogNoBefore} after={l.catalogNoAfter} op={l.operation} />
								</td>
								<td className="muted">{l.manufacturerAfter ?? l.manufacturerBefore ?? '—'}</td>
								<td className="muted">
									<DiffCell before={l.descriptionBefore} after={l.descriptionAfter} op={l.operation} />
								</td>
								<td style={{ textAlign: 'right' }}>
									<DiffCell
										before={l.qtyBefore ? Number(l.qtyBefore).toLocaleString() : null}
										after={l.qtyAfter ? Number(l.qtyAfter).toLocaleString() : null}
										op={l.operation}
									/>{' '}
									<span className="muted">{l.qtyTypeAfter ?? l.qtyTypeBefore ?? ''}</span>
								</td>
								<td style={{ textAlign: 'right' }}>
									<DiffCell
										before={l.unitDnBefore ? usd.format(Number(l.unitDnBefore)) : null}
										after={l.unitDnAfter ? usd.format(Number(l.unitDnAfter)) : null}
										op={l.operation}
									/>
								</td>
								<td
									style={{
										textAlign: 'right',
										color:
											Number(l.lineTotalDelta ?? 0) > 0
												? '#7a1212'
												: Number(l.lineTotalDelta ?? 0) < 0
													? '#0a7c2f'
													: '#666',
										fontWeight: 600
									}}
								>
									{Number(l.lineTotalDelta ?? 0) !== 0
										? `${Number(l.lineTotalDelta) > 0 ? '+' : ''}${usd.format(Number(l.lineTotalDelta ?? 0))}`
										: '—'}
								</td>
								<td className="muted" style={{ fontSize: '11px' }}>
									{l.reasonText ?? ''}
								</td>
								{isDraft && (
									<td>
										<button
											onClick={() => onDeleteCoLine(l.id)}
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

			{/* === MODIFY EXISTING LINE === */}
			{isDraft && eligiblePoLines.length > 0 && (
				<>
					<h2 style={{ marginTop: '32px' }}>Modify or remove an existing PO line</h2>
					<table className="plain" style={{ fontSize: '12px', maxWidth: '1100px' }}>
						<thead>
							<tr>
								<th>Catalog #</th>
								<th>Manufacturer</th>
								<th>Description</th>
								<th style={{ textAlign: 'right' }}>Current qty</th>
								<th style={{ textAlign: 'right' }}>Current unit DN</th>
								<th>Modify…</th>
								<th>Remove</th>
							</tr>
						</thead>
						<tbody>
							{eligiblePoLines.map((p) => (
								<ModifyLineRow
									key={p.id}
									line={p}
									modifyAction={modifyAction}
									onRemove={() => onRemoveLine(p.id)}
									pending={pending}
								/>
							))}
						</tbody>
					</table>
				</>
			)}

			{/* === ADD BRAND-NEW LINE === */}
			{isDraft && (
				<>
					<h2 style={{ marginTop: '32px' }}>Add a brand-new line to the PO</h2>
					<form action={addAction}>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: '0.7fr 1fr 1fr 2fr 0.6fr 0.5fr 0.8fr auto',
								gap: '8px',
								maxWidth: '1200px',
								alignItems: 'end'
							}}
						>
							<label>
								Type
								<input name="type" type="text" style={{ width: '100%' }} />
							</label>
							<label>
								Catalog #*
								<input name="catalogNo" type="text" required style={{ width: '100%' }} />
							</label>
							<label>
								Manufacturer
								<input name="manufacturer" type="text" style={{ width: '100%' }} />
							</label>
							<label>
								Description
								<input name="description" type="text" style={{ width: '100%' }} />
							</label>
							<label>
								Qty*
								<input name="qty" type="number" step="0.01" required style={{ width: '100%' }} />
							</label>
							<label>
								UoM
								<input name="qtyType" type="text" placeholder="EA" style={{ width: '100%' }} />
							</label>
							<label>
								Unit DN*
								<input name="unitDn" type="number" step="0.01" required style={{ width: '100%' }} />
							</label>
							<button className="primary" type="submit" disabled={pending}>
								+ Add
							</button>
						</div>
						<label style={{ display: 'block', marginTop: '8px', maxWidth: '600px' }}>
							Reason (optional)
							<input name="reasonText" type="text" style={{ width: '100%' }} placeholder="e.g. Client added bathroom sconces" />
						</label>
					</form>
				</>
			)}
		</>
	);
}

function ModifyLineRow({
	line,
	modifyAction,
	onRemove,
	pending
}: {
	line: PoLineOption;
	modifyAction: (formData: FormData) => Promise<void>;
	onRemove: () => void;
	pending: boolean;
}) {
	const [show, setShow] = useState(false);
	return (
		<>
			<tr>
				<td>{line.catalogNo ?? '—'}</td>
				<td>{line.manufacturer ?? '—'}</td>
				<td className="muted">{line.description ?? '—'}</td>
				<td style={{ textAlign: 'right' }}>
					{line.qty ? Number(line.qty).toLocaleString() : '—'}{' '}
					<span className="muted">{line.qtyType ?? ''}</span>
				</td>
				<td style={{ textAlign: 'right' }}>
					{line.unitDn
						? Number(line.unitDn).toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD',
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})
						: '—'}
				</td>
				<td>
					<button onClick={() => setShow(!show)} style={{ fontSize: '11px' }}>
						{show ? 'Cancel' : 'Modify'}
					</button>
				</td>
				<td>
					<button onClick={onRemove} disabled={pending} style={{ fontSize: '11px' }}>
						Remove
					</button>
				</td>
			</tr>
			{show && (
				<tr>
					<td colSpan={7} style={{ background: '#fafafa', padding: '12px' }}>
						<form action={modifyAction}>
							<input type="hidden" name="orderLineId" value={line.id} />
							<div
								style={{
									display: 'grid',
									gridTemplateColumns: '1fr 1fr 1fr 1fr',
									gap: '8px',
									alignItems: 'end'
								}}
							>
								<label>
									Qty after (blank = no change)
									<input name="qtyAfter" type="number" step="0.01" style={{ width: '100%' }} />
								</label>
								<label>
									Unit DN after
									<input name="unitDnAfter" type="number" step="0.01" style={{ width: '100%' }} />
								</label>
								<label>
									Catalog # after
									<input name="catalogNoAfter" type="text" style={{ width: '100%' }} />
								</label>
								<label>
									Description after
									<input name="descriptionAfter" type="text" style={{ width: '100%' }} />
								</label>
							</div>
							<label style={{ display: 'block', marginTop: '8px' }}>
								Reason
								<input name="reasonText" type="text" style={{ width: '100%' }} placeholder="e.g. Manufacturer price increase" />
							</label>
							<div style={{ marginTop: '8px' }}>
								<button className="primary" type="submit" disabled={pending}>
									Add modification to CO
								</button>
							</div>
						</form>
					</td>
				</tr>
			)}
		</>
	);
}

function DiffCell({
	before,
	after,
	op
}: {
	before: string | null;
	after: string | null;
	op: string;
}) {
	if (op === 'add') return <span style={{ color: '#0a7c2f' }}>+ {after ?? '—'}</span>;
	if (op === 'remove') return <span style={{ color: '#7a1212', textDecoration: 'line-through' }}>{before ?? '—'}</span>;
	if (before === after || after === null || before === null) return <span>{after ?? before ?? '—'}</span>;
	return (
		<span>
			<span className="muted" style={{ textDecoration: 'line-through' }}>{before}</span>{' '}
			→ <strong>{after}</strong>
		</span>
	);
}

function OpBadge({ op }: { op: string }) {
	const colors: Record<string, { bg: string; fg: string; label: string }> = {
		add: { bg: '#d4edda', fg: '#155724', label: 'ADD' },
		remove: { bg: '#f5d6d6', fg: '#7a1212', label: 'REMOVE' },
		modify: { bg: '#fff3cd', fg: '#7a5d00', label: 'MODIFY' }
	};
	const c = colors[op] ?? { bg: '#eee', fg: '#333', label: op };
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
			{c.label}
		</span>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		draft: { bg: '#eef', fg: '#445' },
		sent: { bg: '#fff3cd', fg: '#7a5d00' },
		acknowledged: { bg: '#cfe9ff', fg: '#0a3a6e' },
		applied: { bg: '#d4edda', fg: '#155724' },
		rejected: { bg: '#f5d6d6', fg: '#7a1212' },
		cancelled: { bg: '#eee', fg: '#666' }
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
