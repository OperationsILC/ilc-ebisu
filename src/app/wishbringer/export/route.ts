import { db } from '@/lib/db';
import { wishes, wishComments, users } from '@/lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { requireUser } from '@/lib/dal';

/**
 * Markdown export of the entire Wishbringer journal — every wish, every
 * comment, status timestamps, who submitted what, which URL they were on.
 * The intended use is: Sean clicks "Download journal as markdown" on
 * /wishbringer, gets a single .md file, hands it to Claude.
 *
 * Format goals:
 *   - Easy to read end-to-end
 *   - Visually marks done / wont_do / in-progress
 *   - Claude-comment marker so closed-loop replies are obvious
 *   - Newest wishes first; comments within each wish in chronological order
 */
export async function GET() {
	// Auth-gate the export — there's no sensitive data here per se but the
	// journal is internal and shouldn't be world-readable.
	await requireUser();

	const wishRows = await db
		.select({
			id: wishes.id,
			body: wishes.body,
			status: wishes.status,
			urlAtSubmission: wishes.urlAtSubmission,
			createdAt: wishes.createdAt,
			updatedAt: wishes.updatedAt,
			resolvedAt: wishes.resolvedAt,
			submitterEmail: users.email,
			submitterName: users.name
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
			authorEmail: users.email,
			authorName: users.name,
			authorRole: users.role
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

	const now = new Date();
	const dateStamp = now.toISOString().slice(0, 10);

	const lines: string[] = [];
	lines.push(`# Wishbringer Journal — Ebisu`);
	lines.push(``);
	lines.push(`Exported ${now.toISOString()} · ${wishRows.length} wish(es) total.`);
	lines.push(``);
	lines.push(`---`);
	lines.push(``);

	if (wishRows.length === 0) {
		lines.push(`_No wishes yet._`);
	}

	for (const w of wishRows) {
		const statusBadge =
			w.status === 'done'
				? '✅ DONE'
				: w.status === 'wont_do'
					? '🚫 WON’T DO'
					: w.status === 'in_progress'
						? '🛠 IN PROGRESS'
						: '🔵 OPEN';

		const submitter = w.submitterName ?? w.submitterEmail;
		const created = new Date(w.createdAt).toISOString();
		const resolved = w.resolvedAt ? new Date(w.resolvedAt).toISOString() : null;

		lines.push(`## Wish ${shortId(w.id)} — ${statusBadge}`);
		lines.push(``);
		lines.push(`- **Submitted by:** ${submitter}`);
		lines.push(`- **Submitted at:** ${created}`);
		if (w.urlAtSubmission) {
			lines.push(`- **From URL:** \`${w.urlAtSubmission}\``);
		}
		if (resolved) {
			lines.push(`- **Resolved at:** ${resolved}`);
		}
		lines.push(``);
		lines.push(`### Wish`);
		lines.push(``);
		lines.push(w.body);
		lines.push(``);

		const comments = commentsByWish.get(w.id) ?? [];
		if (comments.length > 0) {
			lines.push(`### Comments`);
			lines.push(``);
			for (const c of comments) {
				const tag = c.isClaudeNote
					? '🤖 **Claude (via dev)**'
					: c.authorRole === 'admin'
						? `**${c.authorName ?? c.authorEmail} (admin)**`
						: `**${c.authorName ?? c.authorEmail}**`;
				lines.push(`- ${tag} · ${new Date(c.createdAt).toISOString()}`);
				const indented = c.body
					.split('\n')
					.map((l) => `  ${l}`)
					.join('\n');
				lines.push(indented);
				lines.push(``);
			}
		}

		lines.push(`---`);
		lines.push(``);
	}

	const body = lines.join('\n');
	const filename = `wishbringer-${dateStamp}.md`;

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
}

// Short alias for display — first 8 of the UUID, sufficient for journal labels.
function shortId(uuid: string): string {
	return uuid.slice(0, 8);
}
