'use client';

import { useState, useTransition } from 'react';
import { saveQboDefaultAccounts, type QboAccount } from './actions';

type Props = {
	connected: boolean;
	environment: string;
	connection: {
		realmId: string;
		connectedAt: string;
		connectorEmail: string | null;
		defaultIncomeAccountId: string | null;
		defaultIncomeAccountName: string | null;
		defaultCogsAccountId: string | null;
		defaultCogsAccountName: string | null;
	} | null;
	companyName: string | null;
	pingError: string | null;
	incomeAccounts: QboAccount[];
	cogsAccounts: QboAccount[];
	accountsError: string | null;
};

export default function QboSettingsClient({
	connected,
	environment,
	connection,
	companyName,
	pingError,
	incomeAccounts,
	cogsAccounts,
	accountsError
}: Props) {
	const [pending, startTransition] = useTransition();
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [incomeId, setIncomeId] = useState(connection?.defaultIncomeAccountId ?? '');
	const [cogsId, setCogsId] = useState(connection?.defaultCogsAccountId ?? '');

	function onSaveAccounts() {
		const income = incomeAccounts.find((a) => a.Id === incomeId);
		const cogs = cogsAccounts.find((a) => a.Id === cogsId);
		if (!income || !cogs) {
			setError('Pick both an income account and a COGS/expense account.');
			return;
		}
		startTransition(async () => {
			const r = await saveQboDefaultAccounts(income.Id, income.Name, cogs.Id, cogs.Name);
			if (r.error) {
				setError(r.error);
				setFlash(null);
			} else {
				setFlash('Saved.');
				setError(null);
				setTimeout(() => setFlash(null), 3000);
			}
		});
	}

	if (!connected) {
		return (
			<div style={{ maxWidth: '720px' }}>
				<h2>Connect to QBO</h2>
				<p>
					Authorize Ebisu to read from and write to your{' '}
					<strong>{environment.toUpperCase()}</strong> QuickBooks Online company. You&apos;ll
					be redirected to Intuit, pick the company, then sent back here.
				</p>
				<p className="muted" style={{ fontSize: '12px' }}>
					Tokens are encrypted at rest. Ebisu never sees your QBO password.
				</p>
				<a href="/api/qbo/connect">
					<button className="primary" type="button">
						Connect to QBO ({environment}) →
					</button>
				</a>
			</div>
		);
	}

	const accountsReady = !!connection?.defaultIncomeAccountId && !!connection?.defaultCogsAccountId;

	return (
		<div style={{ maxWidth: '900px' }}>
			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<h2>Connection</h2>
			<table className="plain" style={{ maxWidth: '700px' }}>
				<tbody>
					<tr>
						<th>QBO company</th>
						<td>
							{companyName ?? <span className="muted">(failed to ping)</span>}
							{pingError && <div className="muted" style={{ fontSize: '11px', color: '#7a1212' }}>{pingError}</div>}
						</td>
					</tr>
					<tr>
						<th>Realm ID</th>
						<td className="muted" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
							{connection?.realmId}
						</td>
					</tr>
					<tr>
						<th>Connected at</th>
						<td>{connection ? new Date(connection.connectedAt).toLocaleString() : ''}</td>
					</tr>
					<tr>
						<th>Connected by</th>
						<td>{connection?.connectorEmail ?? '—'}</td>
					</tr>
				</tbody>
			</table>

			<form action="/api/qbo/disconnect" method="post" style={{ marginTop: '12px' }}>
				<button type="submit" disabled={pending}>
					Disconnect
				</button>
				<span className="muted" style={{ marginLeft: '8px', fontSize: '12px' }}>
					Revokes the tokens at Intuit and marks the connection inactive locally.
				</span>
			</form>

			<h2 style={{ marginTop: '32px' }}>
				Default accounts{' '}
				{!accountsReady && (
					<span style={{ fontSize: '13px', color: '#7a1212', fontWeight: 'normal' }}>
						— required before pushing
					</span>
				)}
			</h2>
			<p className="muted" style={{ fontSize: '12px' }}>
				QBO requires an Income account on every Item we create (so invoice revenue flows
				correctly), and a COGS/Expense account for bills. Pick once; Ebisu uses these as
				defaults for every product Item created going forward.
			</p>

			{accountsError ? (
				<p className="flash error">
					Couldn&apos;t load accounts from QBO: {accountsError}
				</p>
			) : (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr 1fr',
						gap: '12px',
						alignItems: 'end'
					}}
				>
					<label>
						Default income account (invoices)
						<select
							value={incomeId}
							onChange={(e) => setIncomeId(e.target.value)}
							disabled={pending}
							style={{ width: '100%' }}
						>
							<option value="">— pick —</option>
							{incomeAccounts.map((a) => (
								<option key={a.Id} value={a.Id}>
									{a.Name} {a.AccountSubType ? `(${a.AccountSubType})` : ''}
								</option>
							))}
						</select>
					</label>
					<label>
						Default COGS / expense account (bills)
						<select
							value={cogsId}
							onChange={(e) => setCogsId(e.target.value)}
							disabled={pending}
							style={{ width: '100%' }}
						>
							<option value="">— pick —</option>
							{cogsAccounts.map((a) => (
								<option key={a.Id} value={a.Id}>
									{a.Name} ({a.AccountType}
									{a.AccountSubType ? ` · ${a.AccountSubType}` : ''})
								</option>
							))}
						</select>
					</label>
				</div>
			)}

			<div style={{ marginTop: '12px' }}>
				<button
					className="primary"
					onClick={onSaveAccounts}
					disabled={pending || !incomeId || !cogsId}
				>
					{pending ? 'Saving…' : 'Save defaults'}
				</button>
			</div>

			<h2 style={{ marginTop: '32px' }}>Next steps</h2>
			<p>
				Once default accounts are picked, head to{' '}
				<a href="/companies">Companies</a> to link each Ebisu company to its QBO Customer or
				Vendor record. The lookup-or-link UI is on each company&apos;s edit page.
			</p>
			<p className="muted" style={{ fontSize: '12px' }}>
				Push actions (Invoice → QBO, Bill → QBO, Change Order → QBO) require: (1) this
				connection, (2) default accounts saved, and (3) the relevant company linked to its QBO
				record.
			</p>
		</div>
	);
}
