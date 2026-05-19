'use client';

import { useState, useTransition } from 'react';
import {
	submitWish,
	editOwnWish,
	addWishComment,
	setWishStatus
} from './actions';

export type WishCommentView = {
	id: string;
	body: string;
	isClaudeNote: boolean;
	createdAt: string;
	authorLabel: string;
};

export type WishView = {
	id: string;
	body: string;
	status: string;
	urlAtSubmission: string | null;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
	submittedBy: string;
	isMine: boolean;
	comments: WishCommentView[];
};

const STATUSES: Array<{ value: string; label: string }> = [
	{ value: 'open', label: 'Open' },
	{ value: 'in_progress', label: 'In progress' },
	{ value: 'done', label: 'Done' },
	{ value: 'wont_do', label: "Won't do" }
];

export default function WishbringerClient({
	wishes,
	isAdmin,
	defaultFromUrl
}: {
	wishes: WishView[];
	isAdmin: boolean;
	defaultFromUrl: string;
}) {
	const [flash, setFlash] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	function flashThen(msg: string) {
		setFlash(msg);
		setError(null);
		setTimeout(() => setFlash(null), 3500);
	}
	function errorThen(msg: string) {
		setError(msg);
		setFlash(null);
	}

	return (
		<>
			{flash && <p className="flash success">{flash}</p>}
			{error && <p className="flash error">{error}</p>}

			<NewWishComposer
				defaultFromUrl={defaultFromUrl}
				onFlash={flashThen}
				onError={errorThen}
			/>

			{wishes.length === 0 ? (
				<p className="muted" style={{ marginTop: '24px' }}>
					No wishes match the filter yet. Be the first.
				</p>
			) : (
				<div style={{ marginTop: '24px' }}>
					{wishes.map((w) => (
						<WishCard
							key={w.id}
							wish={w}
							isAdmin={isAdmin}
							onFlash={flashThen}
							onError={errorThen}
						/>
					))}
				</div>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// New wish composer
// ---------------------------------------------------------------------------

function NewWishComposer({
	defaultFromUrl,
	onFlash,
	onError
}: {
	defaultFromUrl: string;
	onFlash: (s: string) => void;
	onError: (s: string) => void;
}) {
	const [body, setBody] = useState('');
	const [url, setUrl] = useState(defaultFromUrl);
	const [pending, startTransition] = useTransition();

	function onSubmit() {
		if (body.trim() === '') {
			onError('Type something first.');
			return;
		}
		startTransition(async () => {
			const r = await submitWish(body, url || null);
			if (r.error) onError(r.error);
			else {
				onFlash('Wish submitted. Thanks!');
				setBody('');
				// Keep the URL field — likely they'll add more from the same page.
				setTimeout(() => window.location.reload(), 600);
			}
		});
	}

	return (
		<div
			style={{
				border: '1px solid #ddd',
				borderRadius: '4px',
				padding: '12px',
				background: '#fff',
				maxWidth: '900px'
			}}
		>
			<h2 style={{ marginTop: 0, marginBottom: 8 }}>Drop a new wish</h2>
			<div style={{ marginBottom: '8px' }}>
				<label style={{ display: 'block', fontSize: '12px', marginBottom: '2px' }}>
					Which page? (auto-captured; edit if wrong)
				</label>
				<input
					type="text"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="/projects/abc/ship-qap"
					style={{ width: '100%', fontSize: '12px' }}
					disabled={pending}
				/>
			</div>
			<textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				placeholder="What would make Ebisu better? Plain English is fine."
				rows={5}
				style={{ width: '100%', fontFamily: 'inherit' }}
				disabled={pending}
			/>
			<div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
				<button className="primary" onClick={onSubmit} disabled={pending}>
					{pending ? 'Submitting…' : 'Submit wish'}
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Individual wish card with edit / comment / status controls
// ---------------------------------------------------------------------------

function WishCard({
	wish,
	isAdmin,
	onFlash,
	onError
}: {
	wish: WishView;
	isAdmin: boolean;
	onFlash: (s: string) => void;
	onError: (s: string) => void;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const [editBody, setEditBody] = useState(wish.body);
	const [commenting, setCommenting] = useState(false);
	const [commentBody, setCommentBody] = useState('');
	const [commentIsClaude, setCommentIsClaude] = useState(false);

	function saveEdit() {
		if (editBody.trim() === '') {
			onError('Body cannot be empty.');
			return;
		}
		startTransition(async () => {
			const r = await editOwnWish(wish.id, editBody);
			if (r.error) onError(r.error);
			else {
				onFlash('Wish updated.');
				setEditing(false);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function postComment() {
		if (commentBody.trim() === '') {
			onError('Type a comment first.');
			return;
		}
		startTransition(async () => {
			const r = await addWishComment(wish.id, commentBody, commentIsClaude);
			if (r.error) onError(r.error);
			else {
				onFlash('Comment added.');
				setCommentBody('');
				setCommentIsClaude(false);
				setCommenting(false);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	function onStatusChange(newStatus: string) {
		startTransition(async () => {
			const r = await setWishStatus(wish.id, newStatus);
			if (r.error) onError(r.error);
			else {
				onFlash(`Status changed to ${newStatus.replace('_', ' ')}.`);
				setTimeout(() => window.location.reload(), 500);
			}
		});
	}

	const created = new Date(wish.createdAt).toLocaleString();
	const updated = new Date(wish.updatedAt).toLocaleString();
	const edited = wish.updatedAt !== wish.createdAt;

	const statusColor = {
		open: '#1a4ed8',
		in_progress: '#7a5d00',
		done: '#0a7c2f',
		wont_do: '#666'
	}[wish.status] ?? '#333';

	return (
		<div
			style={{
				border: '1px solid #ddd',
				borderRadius: '4px',
				background: '#fff',
				padding: '12px 14px',
				marginBottom: '12px',
				maxWidth: '900px'
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'baseline',
					marginBottom: '6px',
					flexWrap: 'wrap',
					gap: '8px'
				}}
			>
				<div>
					<span
						style={{
							background: statusColor,
							color: '#fff',
							padding: '2px 8px',
							borderRadius: '3px',
							fontSize: '11px',
							fontWeight: 600,
							textTransform: 'uppercase',
							marginRight: '6px'
						}}
					>
						{wish.status.replace('_', ' ')}
					</span>
					<strong>{wish.submittedBy}</strong>{' '}
					<span className="muted" style={{ fontSize: '12px' }}>
						· {created}
						{edited && ` · edited ${updated}`}
					</span>
				</div>
				{wish.urlAtSubmission && (
					<a
						href={wish.urlAtSubmission}
						style={{ fontSize: '12px' }}
						title="Jump to the page they were on"
					>
						{wish.urlAtSubmission}
					</a>
				)}
			</div>

			{editing ? (
				<>
					<textarea
						value={editBody}
						onChange={(e) => setEditBody(e.target.value)}
						rows={5}
						style={{ width: '100%', fontFamily: 'inherit' }}
						disabled={pending}
					/>
					<div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
						<button className="primary" onClick={saveEdit} disabled={pending}>
							Save
						</button>
						<button onClick={() => setEditing(false)} disabled={pending}>
							Cancel
						</button>
					</div>
				</>
			) : (
				<div style={{ whiteSpace: 'pre-wrap', margin: '4px 0 8px' }}>{wish.body}</div>
			)}

			{!editing && (
				<div
					style={{
						display: 'flex',
						gap: '8px',
						marginTop: '6px',
						flexWrap: 'wrap',
						alignItems: 'center'
					}}
				>
					{wish.isMine && (
						<button
							onClick={() => {
								setEditBody(wish.body);
								setEditing(true);
							}}
							disabled={pending}
							style={{ fontSize: '11px' }}
						>
							✎ Edit
						</button>
					)}
					<button
						onClick={() => setCommenting(!commenting)}
						disabled={pending}
						style={{ fontSize: '11px' }}
					>
						💬 Comment
					</button>
					{isAdmin && (
						<>
							<span className="muted" style={{ fontSize: '11px', marginLeft: '8px' }}>
								Set status:
							</span>
							{STATUSES.filter((s) => s.value !== wish.status).map((s) => (
								<button
									key={s.value}
									onClick={() => onStatusChange(s.value)}
									disabled={pending}
									style={{ fontSize: '11px' }}
								>
									→ {s.label}
								</button>
							))}
						</>
					)}
				</div>
			)}

			{commenting && (
				<div
					style={{
						marginTop: '10px',
						padding: '8px',
						background: '#fafafa',
						border: '1px solid #eee',
						borderRadius: '3px'
					}}
				>
					<textarea
						value={commentBody}
						onChange={(e) => setCommentBody(e.target.value)}
						placeholder="Add a comment, ask a question, paste Claude's response…"
						rows={3}
						style={{ width: '100%', fontFamily: 'inherit', fontSize: '13px' }}
						disabled={pending}
					/>
					<div
						style={{
							marginTop: '6px',
							display: 'flex',
							gap: '6px',
							alignItems: 'center',
							flexWrap: 'wrap'
						}}
					>
						<label style={{ fontSize: '12px' }}>
							<input
								type="checkbox"
								checked={commentIsClaude}
								onChange={(e) => setCommentIsClaude(e.target.checked)}
								style={{ marginRight: '4px' }}
								disabled={pending}
							/>
							This is from Claude
						</label>
						<button className="primary" onClick={postComment} disabled={pending}>
							Post
						</button>
						<button onClick={() => setCommenting(false)} disabled={pending}>
							Cancel
						</button>
					</div>
				</div>
			)}

			{wish.comments.length > 0 && (
				<div
					style={{
						marginTop: '12px',
						paddingTop: '8px',
						borderTop: '1px solid #eee'
					}}
				>
					{wish.comments.map((c) => (
						<div
							key={c.id}
							style={{
								padding: '6px 8px',
								marginBottom: '4px',
								background: c.isClaudeNote ? '#eef6ff' : '#fafafa',
								border: c.isClaudeNote ? '1px solid #c0d4ed' : '1px solid #eee',
								borderRadius: '3px',
								fontSize: '13px'
							}}
						>
							<div className="muted" style={{ fontSize: '11px', marginBottom: '2px' }}>
								{c.isClaudeNote ? '🤖 ' : ''}
								<strong>{c.authorLabel}</strong> · {new Date(c.createdAt).toLocaleString()}
							</div>
							<div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
