'use client';

import { useState, useTransition } from 'react';
import { searchQboParty, setCompanyQboLink, type QboPartySearchResult } from '../actions';

type Props = {
	companyId: string;
	companyName: string;
	currentCustomerId: string | null;
	currentVendorId: string | null;
};

export default function QboLinkPanel({
	companyId,
	companyName,
	currentCustomerId,
	currentVendorId
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

	return (
		<div style={{ marginTop: '32px', maxWidth: '900px' }}>
			<h2>Find in QBO</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				Search QBO by name and pick the matching record. Stores the QBO ID on this Ebisu
				company so subsequent invoice / bill pushes attach to the right record. Case-sensitive
				match isn&apos;t required — QBO&apos;s LIKE handles substrings.
			</p>

			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: '24px'
				}}
			>
				<KindPanel
					kind="customer"
					label="Customer (AR — receives invoices)"
					defaultQuery={companyName}
					currentId={currentCustomerId}
					companyId={companyId}
					onError={errorThen}
					onFlash={flashThen}
					pending={pending}
					startTransition={startTransition}
				/>
				<KindPanel
					kind="vendor"
					label="Vendor (AP — sends bills)"
					defaultQuery={companyName}
					currentId={currentVendorId}
					companyId={companyId}
					onError={errorThen}
					onFlash={flashThen}
					pending={pending}
					startTransition={startTransition}
				/>
			</div>
		</div>
	);
}

function KindPanel({
	kind,
	label,
	defaultQuery,
	currentId,
	companyId,
	onError,
	onFlash,
	pending,
	startTransition
}: {
	kind: 'customer' | 'vendor';
	label: string;
	defaultQuery: string;
	currentId: string | null;
	companyId: string;
	onError: (msg: string) => void;
	onFlash: (msg: string) => void;
	pending: boolean;
	startTransition: React.TransitionStartFunction;
}) {
	const [query, setQuery] = useState(defaultQuery);
	const [results, setResults] = useState<QboPartySearchResult['matches']>([]);
	const [searched, setSearched] = useState(false);
	const [manualId, setManualId] = useState(currentId ?? '');

	function onSearch() {
		const q = query.trim();
		if (!q) {
			onError('Type a name to search.');
			return;
		}
		startTransition(async () => {
			const r = await searchQboParty(kind, q);
			if (r.error) {
				onError(r.error);
				return;
			}
			setResults(r.matches);
			setSearched(true);
		});
	}

	function onPick(qboId: string) {
		startTransition(async () => {
			const r = await setCompanyQboLink(companyId, kind, qboId);
			if (r.error) onError(r.error);
			else {
				onFlash(`Linked to QBO ${kind} ${qboId}.`);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onSaveManual() {
		startTransition(async () => {
			const r = await setCompanyQboLink(companyId, kind, manualId);
			if (r.error) onError(r.error);
			else {
				onFlash(manualId.trim() === '' ? `Cleared QBO ${kind} link.` : `Linked to QBO ${kind} ${manualId}.`);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	return (
		<div
			style={{
				padding: '12px',
				border: '1px solid #ddd',
				borderRadius: '4px',
				background: '#fff'
			}}
		>
			<h3 style={{ marginTop: 0 }}>{label}</h3>
			<p className="muted" style={{ fontSize: '11px', margin: '0 0 8px' }}>
				Current ID: <strong>{currentId ?? '— not linked —'}</strong>
			</p>

			<label style={{ display: 'block', fontSize: '12px' }}>
				Search by name
				<div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="e.g. East West Partners"
						style={{ flex: 1 }}
						disabled={pending}
					/>
					<button onClick={onSearch} disabled={pending}>
						Search
					</button>
				</div>
			</label>

			{searched && (
				<div style={{ marginTop: '8px' }}>
					{results.length === 0 ? (
						<p className="muted" style={{ fontSize: '12px' }}>
							No matches. Try a different name or paste an ID manually below.
						</p>
					) : (
						<table className="plain" style={{ fontSize: '12px', width: '100%' }}>
							<thead>
								<tr>
									<th>QBO {kind} ID</th>
									<th>Display name</th>
									<th>Email</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{results.map((m) => (
									<tr
										key={m.id}
										style={
											m.id === currentId ? { background: '#d4edda' } : undefined
										}
									>
										<td className="muted">{m.id}</td>
										<td>{m.displayName}</td>
										<td className="muted">{m.primaryEmail ?? '—'}</td>
										<td>
											<button
												onClick={() => onPick(m.id)}
												disabled={pending}
												style={{ fontSize: '11px' }}
											>
												{m.id === currentId ? 'Already linked' : 'Link'}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			)}

			<details style={{ marginTop: '12px' }}>
				<summary className="muted" style={{ cursor: 'pointer', fontSize: '12px' }}>
					Paste an ID manually
				</summary>
				<div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
					<input
						type="text"
						value={manualId}
						onChange={(e) => setManualId(e.target.value)}
						placeholder="e.g. 42"
						style={{ flex: 1 }}
						disabled={pending}
					/>
					<button onClick={onSaveManual} disabled={pending}>
						Save
					</button>
				</div>
				<p className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
					Empty to clear the link.
				</p>
			</details>
		</div>
	);
}
