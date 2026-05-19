import { db } from '@/lib/db';
import { wishes, wishComments, users } from '@/lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/dal';
import TabHelp from '@/app/components/TabHelp';
import WishbringerClient, { type WishView } from './WishbringerClient';

export default async function WishbringerPage({
	searchParams
}: {
	searchParams: Promise<{ from?: string; status?: string }>;
}) {
	const sp = await searchParams;
	const fromUrl = sp.from ?? '';
	const statusFilter = (sp.status ?? '').trim();

	const me = await getCurrentUser();

	const wishRows = await db
		.select({
			id: wishes.id,
			body: wishes.body,
			status: wishes.status,
			urlAtSubmission: wishes.urlAtSubmission,
			createdAt: wishes.createdAt,
			updatedAt: wishes.updatedAt,
			resolvedAt: wishes.resolvedAt,
			userId: wishes.userId,
			userEmail: users.email,
			userName: users.name
		})
		.from(wishes)
		.innerJoin(users, eq(wishes.userId, users.id))
		.orderBy(desc(wishes.createdAt));

	const allComments = await db
		.select({
			id: wishComments.id,
			wishId: wishComments.wishId,
			body: wishComments.body,
			isClaudeNote: wishComments.isClaudeNote,
			createdAt: wishComments.createdAt,
			userEmail: users.email,
			userName: users.name,
			userRole: users.role
		})
		.from(wishComments)
		.innerJoin(users, eq(wishComments.userId, users.id))
		.orderBy(asc(wishComments.createdAt));

	const commentsByWish = new Map<string, typeof allComments>();
	for (const c of allComments) {
		const list = commentsByWish.get(c.wishId) ?? [];
		list.push(c);
		commentsByWish.set(c.wishId, list);
	}

	const allViews: WishView[] = wishRows.map((w) => ({
		id: w.id,
		body: w.body,
		status: w.status,
		urlAtSubmission: w.urlAtSubmission,
		createdAt: w.createdAt.toISOString(),
		updatedAt: w.updatedAt.toISOString(),
		resolvedAt: w.resolvedAt?.toISOString() ?? null,
		submittedBy: w.userName ?? w.userEmail,
		isMine: me?.id === w.userId,
		comments: (commentsByWish.get(w.id) ?? []).map((c) => ({
			id: c.id,
			body: c.body,
			isClaudeNote: c.isClaudeNote,
			createdAt: c.createdAt.toISOString(),
			authorLabel:
				(c.userName ?? c.userEmail) + (c.userRole === 'admin' ? ' (admin)' : '')
		}))
	}));

	const visibleViews =
		statusFilter !== '' ? allViews.filter((v) => v.status === statusFilter) : allViews;

	const counts = {
		total: allViews.length,
		open: allViews.filter((v) => v.status === 'open').length,
		inProgress: allViews.filter((v) => v.status === 'in_progress').length,
		done: allViews.filter((v) => v.status === 'done').length,
		wontDo: allViews.filter((v) => v.status === 'wont_do').length
	};

	const isAdmin = me?.role === 'admin';

	return (
		<>
			<h1>💡 Wishbringer</h1>

			<TabHelp tabKey="wishbringer" title="Drop a wish, leave a note, close the loop">
				<p style={{ margin: '0 0 6px' }}>
					Anywhere in Ebisu doesn&apos;t do what you want? Type it here. The page you were
					on when you clicked the Wishbringer link is auto-captured so the dev knows where
					you meant it.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>Submit</strong> a wish — anyone signed in can. Your own wishes stay
						editable forever.
					</li>
					<li>
						<strong>Comment</strong> on anyone&apos;s wish — clarifications, questions,
						&quot;me too&quot;. Devs paste Claude&apos;s response back here when work&apos;s
						done.
					</li>
					<li>
						<strong>Status</strong>: open → in progress → done (or won&apos;t do). Admins
						set status. Marking done timestamps when + by whom.
					</li>
					<li>
						<strong>Export</strong> the whole journal as markdown to hand to Claude. Link
						at the bottom of this page.
					</li>
				</ul>
			</TabHelp>

			<div
				style={{
					display: 'flex',
					gap: '8px',
					margin: '16px 0',
					alignItems: 'baseline',
					flexWrap: 'wrap'
				}}
			>
				<strong style={{ fontSize: '13px' }}>Filter:</strong>
				<StatusLink label={`All (${counts.total})`} status="" active={statusFilter === ''} />
				<StatusLink
					label={`Open (${counts.open})`}
					status="open"
					active={statusFilter === 'open'}
				/>
				<StatusLink
					label={`In progress (${counts.inProgress})`}
					status="in_progress"
					active={statusFilter === 'in_progress'}
				/>
				<StatusLink
					label={`Done (${counts.done})`}
					status="done"
					active={statusFilter === 'done'}
				/>
				<StatusLink
					label={`Won't do (${counts.wontDo})`}
					status="wont_do"
					active={statusFilter === 'wont_do'}
				/>
			</div>

			<WishbringerClient
				wishes={visibleViews}
				isAdmin={isAdmin}
				defaultFromUrl={fromUrl}
			/>

			<hr style={{ margin: '32px 0 16px' }} />
			<p>
				<a href="/wishbringer/export" download style={{ fontWeight: 600 }}>
					⬇ Download journal as markdown
				</a>{' '}
				<span className="muted">
					— hand to Claude for triage. Captures every wish + comments + status.
				</span>
			</p>
		</>
	);
}

function StatusLink({
	label,
	status,
	active
}: {
	label: string;
	status: string;
	active: boolean;
}) {
	const href = status === '' ? '/wishbringer' : `/wishbringer?status=${status}`;
	return (
		<a
			href={href}
			style={{
				fontSize: '12px',
				padding: '2px 8px',
				borderRadius: '3px',
				background: active ? '#1a4ed8' : '#eee',
				color: active ? '#fff' : '#333',
				textDecoration: 'none'
			}}
		>
			{label}
		</a>
	);
}
