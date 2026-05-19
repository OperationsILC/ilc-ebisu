'use client';

import { useEffect, useState } from 'react';

/**
 * Dismissable "How to use this tab" hint box, rendered at the top of each
 * project sub-page. Default visible. When the user dismisses it, we persist
 * that choice in localStorage under `ebisu.help.hide.<tabKey>`. Per-browser,
 * per-machine — no DB round-trip. A small "ⓘ Show help" link replaces it
 * once dismissed so the user can bring the panel back without hunting for a
 * setting somewhere.
 *
 * Why localStorage and not a user-pref column: this is meta-UI, not data.
 * If a PM signs in from a different machine they get the help banner again,
 * which is actually fine — it's a teaching aid, not a personalization
 * setting people care about syncing.
 *
 * Pass `title` to override the default "How to use this tab" heading. Pass
 * children for the body content (markdown-free — just JSX).
 */
type Props = {
	tabKey: string;
	title?: string;
	children: React.ReactNode;
};

export default function TabHelp({ tabKey, title = 'How to use this tab', children }: Props) {
	const storageKey = `ebisu.help.hide.${tabKey}`;
	// `null` while we haven't read localStorage yet — prevents SSR/client flicker
	// from rendering one state and then immediately flipping.
	const [dismissed, setDismissed] = useState<boolean | null>(null);

	useEffect(() => {
		try {
			setDismissed(window.localStorage.getItem(storageKey) === '1');
		} catch {
			setDismissed(false);
		}
	}, [storageKey]);

	function dismiss() {
		setDismissed(true);
		try {
			window.localStorage.setItem(storageKey, '1');
		} catch {
			/* localStorage unavailable — fine, just stays dismissed for this view */
		}
	}

	function restore() {
		setDismissed(false);
		try {
			window.localStorage.removeItem(storageKey);
		} catch {
			/* same */
		}
	}

	// SSR pass + first client paint: render the panel (default visible).
	// After useEffect runs we know the real preference.
	if (dismissed === null) {
		return <PanelShell title={title} onDismiss={dismiss}>{children}</PanelShell>;
	}

	if (dismissed) {
		return (
			<p style={{ margin: '8px 0', fontSize: '12px' }}>
				<a
					href="#"
					onClick={(e) => {
						e.preventDefault();
						restore();
					}}
					style={{ textDecoration: 'none' }}
				>
					ⓘ Show help
				</a>
			</p>
		);
	}

	return <PanelShell title={title} onDismiss={dismiss}>{children}</PanelShell>;
}

function PanelShell({
	title,
	children,
	onDismiss
}: {
	title: string;
	onDismiss: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			style={{
				position: 'relative',
				background: '#fff8e1',
				border: '1px solid #f0d878',
				borderRadius: '4px',
				padding: '10px 36px 10px 12px',
				margin: '0 0 16px 0',
				fontSize: '13px',
				lineHeight: 1.5,
				maxWidth: '900px'
			}}
		>
			<div style={{ fontWeight: 600, marginBottom: '4px', color: '#5a4500' }}>
				ⓘ {title}
			</div>
			<div style={{ color: '#3a2e00' }}>{children}</div>
			<button
				onClick={onDismiss}
				title="Hide this help panel"
				aria-label="Hide help"
				style={{
					position: 'absolute',
					top: '6px',
					right: '6px',
					padding: '0 6px',
					fontSize: '14px',
					lineHeight: '20px',
					background: 'transparent',
					border: 'none',
					color: '#5a4500',
					cursor: 'pointer'
				}}
			>
				✕
			</button>
		</div>
	);
}
