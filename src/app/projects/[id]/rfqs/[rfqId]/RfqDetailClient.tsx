'use client';

import { useMemo, useState, useTransition } from 'react';
import {
	updateRfqStatus,
	saveRfqLineEdits,
	applyQuoteToQap,
	applyAllQuotesToQap,
	sendRfqEmail
} from './actions';

type Rfq = {
	id: string;
	rfqNo: string;
	status: string;
	notes: string | null;
	sentAt: string | null;
	createdAt: string;
	repFirm: string | null;
	creatorEmail: string | null;
};

type Line = {
	id: string;
	qapLineId: string;
	qtySnapshot: string | null;
	typeNameSnapshot: string | null;
	catalogNoSnapshot: string | null;
	manufacturerNameSnapshot: string | null;
	descriptionSnapshot: string | null;
	quotedDn: string | null;
	quoteReceivedAt: string | null;
	appliedToQapAt: string | null;
};

type Props = {
	projectId: string;
	projectName: string;
	rfq: Rfq;
	lines: Line[];
};

export default function RfqDetailClient({ projectId, projectName, rfq, lines }: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Local edits before save. Two maps keyed by rfq_line id — one per editable
	// column. We track them separately so we can tell which fields changed and
	// only send those to the server.
	const [qtyEdits, setQtyEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.qtySnapshot ?? '']))
	);
	const [quotedEdits, setQuotedEdits] = useState<Record<string, string>>(() =>
		Object.fromEntries(lines.map((l) => [l.id, l.quotedDn ?? '']))
	);

	const dirtyCount = useMemo(() => {
		let n = 0;
		for (const l of lines) {
			const qty = qtyEdits[l.id] ?? '';
			const origQty = l.qtySnapshot ?? '';
			const quoted = quotedEdits[l.id] ?? '';
			const origQuoted = l.quotedDn ?? '';
			if (qty !== origQty || quoted !== origQuoted) n++;
		}
		return n;
	}, [qtyEdits, quotedEdits, lines]);

	// Effective qty for totals: dirty edit takes precedence over snapshot.
	function effectiveQty(l: Line): number {
		const e = qtyEdits[l.id];
		if (e !== undefined && e !== '') return Number(e);
		return Number(l.qtySnapshot ?? 0);
	}
	function effectiveQuoted(l: Line): number {
		const e = quotedEdits[l.id];
		if (e !== undefined && e !== '') return Number(e);
		return Number(l.quotedDn ?? 0);
	}

	const totalQty = lines.reduce((s, l) => s + effectiveQty(l), 0);
	const linesWithQuotes = lines.filter((l) => (quotedEdits[l.id] ?? '') !== '').length;
	const quotedTotal = lines.reduce(
		(s, l) => s + effectiveQuoted(l) * effectiveQty(l),
		0
	);
	const appliedCount = lines.filter((l) => l.appliedToQapAt !== null).length;
	const pendingApplyCount = lines.filter(
		(l) => l.quotedDn !== null && l.appliedToQapAt === null
	).length;

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 4000);
	}

	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	function onSetStatus(newStatus: string) {
		startTransition(async () => {
			const r = await updateRfqStatus(projectId, rfq.id, newStatus);
			if (r?.error) errorThen(r.error);
			else flashThen(`Status updated to "${newStatus}".`);
		});
	}

	function onSendEmail() {
		if (
			!confirm(
				`Send RFQ ${rfq.rfqNo} via email to ${rfq.repFirm ?? 'the rep firm'}? The email goes to whatever quote-emails are configured on that company. (If DEV_EMAIL_REDIRECT is set, it goes there instead.)`
			)
		)
			return;
		startTransition(async () => {
			const r = await sendRfqEmail(projectId, rfq.id);
			if (r?.error) errorThen(r.error);
			else {
				const dest = r.redirectedTo ? `${r.redirectedTo.join(', ')} (dev redirect)` : r.sentTo?.join(', ');
				flashThen(`Email sent to ${dest}. RFQ marked as sent.`);
			}
		});
	}

	function onSaveLineEdits() {
		const changes: { id: string; fields: { qty?: string; quotedDn?: string } }[] = [];
		for (const l of lines) {
			const qty = qtyEdits[l.id] ?? '';
			const origQty = l.qtySnapshot ?? '';
			const quoted = quotedEdits[l.id] ?? '';
			const origQuoted = l.quotedDn ?? '';
			const fields: { qty?: string; quotedDn?: string } = {};
			if (qty !== origQty) fields.qty = qty;
			if (quoted !== origQuoted) fields.quotedDn = quoted;
			if (Object.keys(fields).length > 0) changes.push({ id: l.id, fields });
		}
		if (changes.length === 0) {
			flashThen('Nothing to save.');
			return;
		}
		startTransition(async () => {
			const r = await saveRfqLineEdits(projectId, rfq.id, JSON.stringify({ changes }));
			if (r?.error) errorThen(r.error);
			else {
				let msg = `Saved ${r.saved} row${r.saved === 1 ? '' : 's'}.`;
				if (r.rejected && r.rejected.length > 0) {
					msg += ` ${r.rejected.length} rejected: ${r.rejected.map((x) => x.reason).join('; ')}`;
				}
				flashThen(msg);
			}
		});
	}

	function onApplyOne(rfqLineId: string) {
		if (!confirm("Push this line's quoted DN to QAP? This updates qap_lines.current_dn.")) return;
		startTransition(async () => {
			const r = await applyQuoteToQap(projectId, rfq.id, rfqLineId);
			if (r?.error) errorThen(r.error);
			else flashThen('Applied to QAP.');
		});
	}

	function onApplyAll() {
		if (pendingApplyCount === 0) {
			flashThen('No unapplied quotes to push.');
			return;
		}
		if (
			!confirm(
				`Apply ${pendingApplyCount} quoted DN${pendingApplyCount === 1 ? '' : 's'} to the QAP? This updates qap_lines.current_dn for each.`
			)
		)
			return;
		startTransition(async () => {
			const r = await applyAllQuotesToQap(projectId, rfq.id);
			if (r?.error) errorThen(r.error);
			else
				flashThen(
					`Applied ${r.applied} quote${r.applied === 1 ? '' : 's'} to QAP${r.skipped > 0 ? ` (${r.skipped} skipped)` : ''}.`
				);
		});
	}

	return (
		<>
			<p>
				<a href={`/projects/${projectId}/rfqs`}>← RFQs for {projectName}</a>
			</p>

			<h1>{rfq.rfqNo}</h1>
			<p className="muted">
				<StatusBadge status={rfq.status} /> · {projectName} · to{' '}
				<strong>{rfq.repFirm ?? '(no rep firm)'}</strong>
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<h2>Status & actions</h2>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
				{(rfq.status === 'draft' || rfq.status === 'sent') && (
					<button className="primary" onClick={onSendEmail} disabled={pending}>
						{rfq.status === 'draft' ? 'Send to rep via email' : 'Resend email'}
					</button>
				)}
				{rfq.status === 'draft' && (
					<button onClick={() => onSetStatus('sent')} disabled={pending}>
						Mark as sent (no email)
					</button>
				)}
				{rfq.status === 'sent' && linesWithQuotes > 0 && (
					<button className="primary" onClick={() => onSetStatus('quoted')} disabled={pending}>
						Mark as quoted
					</button>
				)}
				{(rfq.status === 'sent' || rfq.status === 'quoted') && (
					<>
						<button onClick={() => onSetStatus('accepted')} disabled={pending}>
							Mark as accepted
						</button>
						<button onClick={() => onSetStatus('declined')} disabled={pending}>
							Mark as declined
						</button>
					</>
				)}
				{rfq.status !== 'cancelled' && rfq.status !== 'accepted' && rfq.status !== 'declined' && (
					<button onClick={() => onSetStatus('cancelled')} disabled={pending}>
						Cancel RFQ
					</button>
				)}
				<button onClick={onApplyAll} disabled={pending || pendingApplyCount === 0}>
					Apply all quoted DNs to QAP ({pendingApplyCount})
				</button>
			</div>

			<h2>Header</h2>
			<table className="plain" style={{ maxWidth: '720px', marginBottom: '20px' }}>
				<tbody>
					<tr>
						<th>RFQ NO</th>
						<td>{rfq.rfqNo}</td>
					</tr>
					<tr>
						<th>Rep firm</th>
						<td>{rfq.repFirm ?? '—'}</td>
					</tr>
					<tr>
						<th>Notes</th>
						<td>{rfq.notes ?? '—'}</td>
					</tr>
					<tr>
						<th>Created</th>
						<td>
							{new Date(rfq.createdAt).toLocaleString()} by {rfq.creatorEmail ?? '—'}
						</td>
					</tr>
					<tr>
						<th>Sent</th>
						<td>{rfq.sentAt ? new Date(rfq.sentAt).toLocaleString() : '—'}</td>
					</tr>
				</tbody>
			</table>

			<h2>
				Lines ({lines.length}) — {linesWithQuotes} quoted · {appliedCount} applied to QAP
			</h2>
			<p className="muted">
				Total QTY: {totalQty}
				{quotedTotal > 0 && <> · Quoted total: ${quotedTotal.toLocaleString()}</>}
			</p>

			<div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
				<button
					className="primary"
					onClick={onSaveLineEdits}
					disabled={pending || dirtyCount === 0}
				>
					{pending ? 'Saving…' : `Save changes (${dirtyCount} row${dirtyCount === 1 ? '' : 's'} edited)`}
				</button>
				<span className="muted">
					Tab between cells. Edit QTY and/or QUOTED DN inline, then Save.
				</span>
			</div>

			<table className="plain" style={{ fontSize: '12px' }}>
				<thead>
					<tr>
						<th>TYPE</th>
						<th>CATALOG #</th>
						<th>MANUFACTURER</th>
						<th style={{ textAlign: 'right' }}>QTY</th>
						<th style={{ textAlign: 'right' }}>QUOTED DN</th>
						<th style={{ width: '160px' }}>Status</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((l) => {
						const qtyDirty = (qtyEdits[l.id] ?? '') !== (l.qtySnapshot ?? '');
						const quotedDirty = (quotedEdits[l.id] ?? '') !== (l.quotedDn ?? '');
						const dirtyBg = qtyDirty || quotedDirty ? '#fff3cd' : undefined;
						return (
							<tr key={l.id} style={dirtyBg ? { background: dirtyBg } : undefined}>
								<td>{l.typeNameSnapshot}</td>
								<td>{l.catalogNoSnapshot}</td>
								<td>{l.manufacturerNameSnapshot ?? '—'}</td>
								<td style={{ textAlign: 'right' }}>
									<input
										type="number"
										step="1"
										min="0"
										value={qtyEdits[l.id] ?? ''}
										onChange={(e) => setQtyEdits({ ...qtyEdits, [l.id]: e.target.value })}
										style={{
											width: '70px',
											textAlign: 'right',
											background: qtyDirty ? '#fff' : 'transparent',
											border: qtyDirty ? '1px solid #856404' : '1px solid transparent'
										}}
										placeholder="—"
										disabled={pending}
									/>
								</td>
								<td style={{ textAlign: 'right' }}>
									<input
										type="number"
										step="0.01"
										value={quotedEdits[l.id] ?? ''}
										onChange={(e) =>
											setQuotedEdits({ ...quotedEdits, [l.id]: e.target.value })
										}
										style={{
											width: '100px',
											textAlign: 'right',
											background: quotedDirty ? '#fff' : 'transparent',
											border: quotedDirty ? '1px solid #856404' : '1px solid transparent'
										}}
										placeholder="—"
										disabled={pending}
									/>
								</td>
								<td>
									{l.appliedToQapAt ? (
										<span className="muted">Applied to QAP</span>
									) : l.quotedDn !== null ? (
										<button onClick={() => onApplyOne(l.id)} disabled={pending}>
											Apply to QAP
										</button>
									) : (
										<span className="muted">no quote yet</span>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>

			<p className="muted" style={{ marginTop: '24px' }}>
				PDF generation and email send to the rep are next. For now, RFQs work as internal records
				with status tracking and per-line quote entry.
			</p>
		</>
	);
}

function StatusBadge({ status }: { status: string }) {
	const styles: Record<string, React.CSSProperties> = {
		draft: { background: '#e0e0e0', color: '#555' },
		sent: { background: '#e3f2fd', color: '#1565c0' },
		quoted: { background: '#fff3cd', color: '#856404' },
		accepted: { background: '#e8f5e9', color: '#2e7d32' },
		declined: { background: '#ffebee', color: '#c62828' },
		cancelled: { background: '#f5f5f5', color: '#999' }
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
