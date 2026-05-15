import { db } from '@/lib/db';
import { qboConnections, users } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getQboEnvironment, isQboDryRun } from '@/lib/qbo/env';
import { fetchQboAccounts, pingQboCompany } from './actions';
import QboSettingsClient from './QboSettingsClient';

export default async function QboSettingsPage({
	searchParams
}: {
	searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>;
}) {
	const sp = await searchParams;
	const env = getQboEnvironment();
	const dryRun = isQboDryRun();

	const conn = (
		await db
			.select({
				c: qboConnections,
				connectorEmail: users.email
			})
			.from(qboConnections)
			.leftJoin(users, eq(users.id, qboConnections.connectedByUserId))
			.where(and(eq(qboConnections.environment, env), isNull(qboConnections.disconnectedAt)))
			.limit(1)
	)[0];

	// If connected, ping for company name + fetch accounts (so dropdowns can render)
	const ping = conn ? await pingQboCompany() : null;
	const accounts = conn ? await fetchQboAccounts() : null;

	return (
		<>
			<h1>
				QBO integration{' '}
				<a
					href="/help"
					target="_blank"
					rel="noopener"
					style={{ fontSize: '13px', fontWeight: 'normal' }}
				>
					(help ↗)
				</a>
			</h1>

			{sp.connected === '1' && <p className="flash success">Connected to QBO.</p>}
			{sp.disconnected === '1' && <p className="flash info">Disconnected.</p>}
			{sp.error && <p className="flash error">{sp.error}</p>}

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
					gap: '8px',
					maxWidth: '700px',
					marginBottom: '16px'
				}}
			>
				<MetaCell
					label="Environment"
					value={env.toUpperCase()}
					tone={env === 'production' ? 'danger' : 'info'}
				/>
				<MetaCell
					label="Dry-run"
					value={dryRun ? 'ON' : 'OFF'}
					tone={dryRun ? 'safe' : 'danger'}
				/>
				<MetaCell
					label="Status"
					value={conn ? 'CONNECTED' : 'NOT CONNECTED'}
					tone={conn ? 'safe' : 'warning'}
				/>
			</div>

			<p className="muted" style={{ fontSize: '12px', maxWidth: '700px' }}>
				<strong>Environment</strong> is set by the <code>QBO_ENVIRONMENT</code> env var. Sandbox
				is isolated demo data; production talks to the real ILC QBO. Production keys require
				Intuit app review.{' '}
				<strong>Dry-run</strong>, when ON, makes every push log what it WOULD send without
				actually firing — reads are unaffected. Defaults to ON in production environment, OFF
				in sandbox.
			</p>

			<QboSettingsClient
				connected={!!conn}
				environment={env}
				connection={
					conn
						? {
								realmId: conn.c.realmId,
								connectedAt: conn.c.connectedAt.toISOString(),
								connectorEmail: conn.connectorEmail,
								defaultIncomeAccountId: conn.c.defaultIncomeAccountId,
								defaultIncomeAccountName: conn.c.defaultIncomeAccountName,
								defaultCogsAccountId: conn.c.defaultCogsAccountId,
								defaultCogsAccountName: conn.c.defaultCogsAccountName
							}
						: null
				}
				companyName={ping?.companyName ?? null}
				pingError={ping?.error ?? null}
				incomeAccounts={accounts?.income ?? []}
				cogsAccounts={accounts?.cogs ?? []}
				accountsError={accounts?.error ?? null}
			/>
		</>
	);
}

function MetaCell({
	label,
	value,
	tone
}: {
	label: string;
	value: string;
	tone: 'safe' | 'warning' | 'danger' | 'info';
}) {
	const colors = {
		safe: '#0a7c2f',
		warning: '#7a5d00',
		danger: '#7a1212',
		info: '#0a3a6e'
	};
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
			<div style={{ fontSize: '14px', fontWeight: 600, color: colors[tone] }}>{value}</div>
		</div>
	);
}
