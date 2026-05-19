'use server';

import { db } from '@/lib/db';
import { wishes, wishComments } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Submit / edit own wish
// ---------------------------------------------------------------------------

export type SubmitWishResult = { ok?: true; wishId?: string; error?: string };

export async function submitWish(
	body: string,
	urlAtSubmission: string | null
): Promise<SubmitWishResult> {
	const me = await requireUser();
	const trimmed = body.trim();
	if (trimmed === '') return { error: 'Type something first.' };

	const [created] = await db
		.insert(wishes)
		.values({
			userId: me.id,
			urlAtSubmission: urlAtSubmission?.trim() || null,
			body: trimmed
		})
		.returning({ id: wishes.id });

	revalidatePath('/wishbringer');
	return { ok: true, wishId: created.id };
}

/**
 * Edit your own wish body. Anyone else's wish is off-limits (auth check
 * matches user_id). Admins do NOT override this — author-only edit.
 */
export async function editOwnWish(
	wishId: string,
	newBody: string
): Promise<{ ok?: true; error?: string }> {
	const me = await requireUser();
	const trimmed = newBody.trim();
	if (trimmed === '') return { error: 'Body cannot be empty.' };

	const result = await db
		.update(wishes)
		.set({ body: trimmed, updatedAt: new Date() })
		.where(and(eq(wishes.id, wishId), eq(wishes.userId, me.id)))
		.returning({ id: wishes.id });

	if (result.length === 0) {
		return { error: 'Wish not found, or not yours to edit.' };
	}

	revalidatePath('/wishbringer');
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addWishComment(
	wishId: string,
	body: string,
	isClaudeNote: boolean
): Promise<{ ok?: true; error?: string }> {
	const me = await requireUser();
	const trimmed = body.trim();
	if (trimmed === '') return { error: 'Comment body required.' };

	await db.insert(wishComments).values({
		wishId,
		userId: me.id,
		body: trimmed,
		isClaudeNote: !!isClaudeNote
	});

	revalidatePath('/wishbringer');
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Status changes — admin gated
// ---------------------------------------------------------------------------

const STATUSES = ['open', 'in_progress', 'done', 'wont_do'] as const;
type WishStatus = (typeof STATUSES)[number];

export async function setWishStatus(
	wishId: string,
	status: string
): Promise<{ ok?: true; error?: string }> {
	const me = await requireUser();
	if (me.role !== 'admin') {
		return { error: 'Only admins can change wish status.' };
	}
	if (!STATUSES.includes(status as WishStatus)) {
		return { error: `Unknown status: ${status}` };
	}

	const updates: Record<string, unknown> = {
		status,
		updatedAt: new Date()
	};
	if (status === 'done' || status === 'wont_do') {
		updates.resolvedAt = new Date();
		updates.resolvedByUserId = me.id;
	} else {
		// Re-opening a wish clears the resolved fields.
		updates.resolvedAt = null;
		updates.resolvedByUserId = null;
	}

	const result = await db
		.update(wishes)
		.set(updates)
		.where(eq(wishes.id, wishId))
		.returning({ id: wishes.id });

	if (result.length === 0) return { error: 'Wish not found.' };

	revalidatePath('/wishbringer');
	return { ok: true };
}
