import Link from 'next/link';

const TOPICS = [
	{ slug: 'getting-started', label: 'Getting started' },
	{ slug: 'projects', label: 'Projects' },
	{ slug: 'qap', label: 'QAP — Quantity And Pricing' },
	{ slug: 'rfqs', label: 'RFQs — requesting quotes' },
	{ slug: 'sales-orders', label: 'Sales Orders' },
	{ slug: 'purchase-orders', label: 'Purchase Orders' },
	{ slug: 'shipments', label: 'Shipments & deliveries' },
	{ slug: 'invoices', label: 'Invoices (to clients)' },
	{ slug: 'bills', label: 'Bills (from vendors)' },
	{ slug: 'companies', label: 'Companies — clients, vendors, reps' },
	{ slug: 'glossary', label: 'Glossary' }
];

export default function HelpLayout({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', maxWidth: '1200px' }}>
			<aside
				style={{
					borderRight: '1px solid #ddd',
					paddingRight: '16px',
					fontSize: '13px'
				}}
			>
				<p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#666', margin: '0 0 8px 0' }}>
					Help topics
				</p>
				<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
					{TOPICS.map((t) => (
						<li key={t.slug} style={{ marginBottom: '4px' }}>
							<Link href={`/help/${t.slug}`}>{t.label}</Link>
						</li>
					))}
				</ul>
				<p
					className="muted"
					style={{ fontSize: '11px', marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '12px' }}
				>
					Missing something? Tell Sean what tripped you up — we&apos;ll add it here.
				</p>
			</aside>
			<div>{children}</div>
		</div>
	);
}
