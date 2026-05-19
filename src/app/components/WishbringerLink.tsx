'use client';

import { usePathname } from 'next/navigation';

/**
 * Top-nav link to Wishbringer that auto-attaches the current pathname as the
 * `?from=` query param. The Wishbringer page's composer pre-fills the URL
 * field with that value so PMs don't have to remember which page they were
 * on when they had the thought.
 *
 * Special case: if they're already on /wishbringer (or its subpages), don't
 * attach a from= — that'd be circular.
 */
export default function WishbringerLink() {
	const pathname = usePathname();
	const skipFrom = pathname === '/wishbringer' || pathname.startsWith('/wishbringer/');
	const href = skipFrom
		? '/wishbringer'
		: `/wishbringer?from=${encodeURIComponent(pathname)}`;
	return (
		<a href={href} title="Drop a feature request, bug report, or idea">
			💡 Wishbringer
		</a>
	);
}
