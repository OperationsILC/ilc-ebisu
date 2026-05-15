'use client';

import { useState, type TransitionStartFunction } from 'react';

type Props = {
	docKindLabel: string; // "PO", "SO", "Invoice", "Change Order", "Budget"
	docNo: string;
	defaultTo: string;
	onSend: (to: string) => void | Promise<void>;
	pending: boolean;
	startTransition: TransitionStartFunction;
	disabled?: boolean;
	disabledReason?: string;
};

/**
 * Shared "Send via email" UI used by every document detail page. Renders a
 * collapsed "Send" button by default; expands into a recipient input + confirm
 * Send button so PMs can adjust recipients per-send.
 */
export function SendPanel({
	docKindLabel,
	docNo,
	defaultTo,
	onSend,
	pending,
	startTransition,
	disabled,
	disabledReason
}: Props) {
	const [open, setOpen] = useState(false);
	const [to, setTo] = useState(defaultTo);

	function fire() {
		startTransition(async () => {
			await onSend(to);
			setOpen(false);
		});
	}

	if (disabled) {
		return (
			<div
				style={{
					padding: '8px 12px',
					background: '#fafafa',
					border: '1px solid #ddd',
					borderRadius: '4px',
					margin: '8px 0',
					fontSize: '12px',
					color: '#666'
				}}
			>
				Send via email is disabled: {disabledReason ?? 'requirements not met'}
			</div>
		);
	}

	if (!open) {
		return (
			<div style={{ margin: '8px 0' }}>
				<button onClick={() => setOpen(true)} disabled={pending}>
					Send {docKindLabel} {docNo} via email →
				</button>
			</div>
		);
	}

	return (
		<div
			style={{
				padding: '12px',
				background: '#fff5e0',
				border: '1px solid #e0c890',
				borderRadius: '4px',
				margin: '8px 0',
				maxWidth: '720px'
			}}
		>
			<strong>Send {docKindLabel} {docNo} via email</strong>
			<p className="muted" style={{ fontSize: '12px', margin: '4px 0 8px' }}>
				Branded PDF will be attached. Comma-separate multiple addresses.
			</p>
			<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
				<label style={{ flex: 1 }}>
					<span style={{ fontSize: '11px', color: '#666' }}>To</span>
					<input
						type="text"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						placeholder="rep@example.com, ops@example.com"
						style={{ width: '100%' }}
						disabled={pending}
					/>
				</label>
			</div>
			<div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
				<button className="primary" onClick={fire} disabled={pending || to.trim() === ''}>
					{pending ? 'Sending…' : 'Send'}
				</button>
				<button onClick={() => setOpen(false)} disabled={pending}>
					Cancel
				</button>
			</div>
		</div>
	);
}
