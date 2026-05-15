'use server';

import { db } from '@/lib/db';
import {
	budgets,
	budgetLines,
	qapLines,
	products,
	companies,
	types,
	projects
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import {
	renderDocEmailHtml,
	renderDocEmailText,
	parseEmails,
	type DocEmailLine
} from '@/lib/doc-email';
import { renderBudgetPdf } from '@/lib/pdf/render';
import { type BudgetPdfData } from '@/lib/pdf/budget';

/**
 * Create a draft budget. Auto-numbers BU#####. Copies project financial
 * defaults onto the budget header so the PM can override per-budget.
 */
export async function createBudget(projectId: string) {
	const user = await requireUser();
	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) throw new Error('Project not found');

	const budgetNo = await nextBudgetNo();

	let createdId: string | undefined;
	try {
		const [row] = await db
			.insert(budgets)
			.values({
				projectId,
				budgetNo,
				status: 'draft',
				marginPct: project.marginPct,
				freightPct: project.freightPct,
				warehousingPct: project.warehousingPct,
				salesTaxPct: project.salesTaxPct,
				createdByUserId: user.id
			})
			.returning({ id: budgets.id });
		createdId = row.id;
	} catch (err) {
		if (err instanceof Error && err.message.includes('unique')) {
			// Retry once with the next number
			const retryNo = await nextBudgetNo();
			const [row] = await db
				.insert(budgets)
				.values({
					projectId,
					budgetNo: retryNo,
					status: 'draft',
					marginPct: project.marginPct,
					freightPct: project.freightPct,
					warehousingPct: project.warehousingPct,
					salesTaxPct: project.salesTaxPct,
					createdByUserId: user.id
				})
				.returning({ id: budgets.id });
			createdId = row.id;
		} else {
			throw err;
		}
	}

	if (createdId) redirect(`/projects/${projectId}/budgets/${createdId}`);
}

async function nextBudgetNo(): Promise<string> {
	const [{ n }] = await db.select({ n: count() }).from(budgets);
	return `BU${String(Number(n) + 1).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Budget header edits
// ---------------------------------------------------------------------------

const HeaderSchema = z.object({
	description: z.string().optional(),
	status: z.string().optional(),
	marginPct: z.string().optional(),
	freightPct: z.string().optional(),
	warehousingPct: z.string().optional(),
	salesTaxPct: z.string().optional(),
	notes: z.string().optional()
});

export async function updateBudgetHeader(
	projectId: string,
	budgetId: string,
	formData: FormData
): Promise<void> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = HeaderSchema.safeParse(raw);
	if (!parsed.success) return;
	const v = parsed.data;

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	for (const k of ['description', 'status', 'notes'] as const) {
		if (v[k] !== undefined) updates[k] = v[k].trim() === '' ? null : v[k].trim();
	}
	for (const k of ['marginPct', 'freightPct', 'warehousingPct', 'salesTaxPct'] as const) {
		if (v[k] !== undefined) {
			const t = v[k].trim();
			if (t === '') updates[k] = null;
			else if (Number.isFinite(Number(t))) updates[k] = t;
		}
	}

	await db
		.update(budgets)
		.set(updates)
		.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	revalidatePath(`/projects/${projectId}/budgets`);
}

// ---------------------------------------------------------------------------
// Add lines from QAP — snapshot QAP rows onto the budget
// ---------------------------------------------------------------------------

export async function addQapLinesToBudget(
	projectId: string,
	budgetId: string,
	qapLineIds: string[]
): Promise<{ added?: number; skipped?: number; error?: string }> {
	await requireUser();
	if (qapLineIds.length === 0) return { error: 'No lines selected' };

	const budget = (
		await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, projectId)))
			.limit(1)
	)[0];
	if (!budget) return { error: 'Budget not found' };
	if (budget.status === 'sent' || budget.status === 'confirmed')
		return { error: 'Only draft budgets accept new lines' };

	const linesData = await db
		.select({
			id: qapLines.id,
			projectId: qapLines.projectId,
			qty: qapLines.qty,
			currentDn: qapLines.currentDn,
			marginPct: qapLines.marginPct,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(inArray(qapLines.id, qapLineIds));

	const wrongProject = linesData.filter((l) => l.projectId !== projectId);
	if (wrongProject.length > 0) {
		return { error: 'Some lines do not belong to this project.' };
	}

	// Already-on-budget check
	const existing = await db
		.select({ qapLineId: budgetLines.qapLineId })
		.from(budgetLines)
		.where(and(eq(budgetLines.budgetId, budgetId), inArray(budgetLines.qapLineId, qapLineIds)));
	const existingSet = new Set(existing.map((e) => e.qapLineId));

	let added = 0;
	let skipped = 0;
	for (const l of linesData) {
		if (existingSet.has(l.id)) {
			skipped++;
			continue;
		}
		await db.insert(budgetLines).values({
			budgetId,
			qapLineId: l.id,
			typeNameSnapshot: l.typeName,
			catalogNoSnapshot: l.catalogNo,
			manufacturerNameSnapshot: l.manufacturer,
			descriptionSnapshot: l.description,
			qtySnapshot: l.qty,
			currentDnSnapshot: l.currentDn,
			marginPctSnapshot: l.marginPct,
			qty: l.qty,
			unitDn: l.currentDn
		});
		added++;
	}

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	return { added, skipped };
}

// ---------------------------------------------------------------------------
// Bulk line edits (qty + unit_dn — what-if pricing)
// ---------------------------------------------------------------------------

const LineEditSchema = z.object({
	id: z.string().uuid(),
	qty: z.string().optional(),
	unitDn: z.string().optional()
});
const SaveSchema = z.object({ changes: z.array(LineEditSchema) });

export type SaveBudgetLinesResult = {
	saved: number;
	rejected: { id: string; reason: string }[];
	error?: string;
};

export async function saveBudgetLineEdits(
	budgetId: string,
	payloadJson: string
): Promise<SaveBudgetLinesResult> {
	await requireUser();

	const budget = (await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1))[0];
	if (!budget) return { saved: 0, rejected: [], error: 'Budget not found' };
	if (budget.status === 'sent' || budget.status === 'confirmed')
		return { saved: 0, rejected: [], error: 'Only draft budgets can be edited' };

	let payload: z.infer<typeof SaveSchema>;
	try {
		payload = SaveSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { saved: 0, rejected: [], error: 'Invalid payload' };
	}

	let saved = 0;
	const rejected: SaveBudgetLinesResult['rejected'] = [];
	for (const change of payload.changes) {
		const updates: Record<string, unknown> = {};
		if (change.qty !== undefined) {
			const t = change.qty.trim();
			if (t === '') updates.qty = null;
			else if (Number.isFinite(Number(t))) updates.qty = t;
			else {
				rejected.push({ id: change.id, reason: 'qty must be a number' });
				continue;
			}
		}
		if (change.unitDn !== undefined) {
			const t = change.unitDn.trim();
			if (t === '') updates.unitDn = null;
			else if (Number.isFinite(Number(t))) updates.unitDn = t;
			else {
				rejected.push({ id: change.id, reason: 'unitDn must be a number' });
				continue;
			}
		}
		if (Object.keys(updates).length === 0) continue;
		await db
			.update(budgetLines)
			.set(updates)
			.where(and(eq(budgetLines.id, change.id), eq(budgetLines.budgetId, budgetId)));
		saved++;
	}

	revalidatePath(`/projects/.+/budgets/${budgetId}`, 'page');
	return { saved, rejected };
}

// ---------------------------------------------------------------------------
// Delete a budget line
// ---------------------------------------------------------------------------

export async function deleteBudgetLine(
	projectId: string,
	budgetId: string,
	lineId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const budget = (await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1))[0];
	if (!budget) return { error: 'Budget not found' };
	if (budget.status === 'sent' || budget.status === 'confirmed')
		return { error: 'Only draft budgets can be edited' };

	await db
		.delete(budgetLines)
		.where(and(eq(budgetLines.id, lineId), eq(budgetLines.budgetId, budgetId)));

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Refresh from QAP — replace each budget line's snapshot with current QAP
// (useful when QAP has been updated and the PM wants the budget to follow)
// ---------------------------------------------------------------------------

export async function refreshBudgetFromQap(
	projectId: string,
	budgetId: string
): Promise<{ refreshed?: number; error?: string }> {
	await requireUser();
	const budget = (await db.select().from(budgets).where(eq(budgets.id, budgetId)).limit(1))[0];
	if (!budget) return { error: 'Budget not found' };
	if (budget.status === 'sent' || budget.status === 'confirmed')
		return { error: 'Only draft budgets can be refreshed' };

	const lines = await db
		.select({
			id: budgetLines.id,
			qapLineId: budgetLines.qapLineId
		})
		.from(budgetLines)
		.where(eq(budgetLines.budgetId, budgetId));

	const qapIds = lines.map((l) => l.qapLineId).filter((x): x is string => x !== null);
	if (qapIds.length === 0) return { refreshed: 0 };

	const fresh = await db
		.select({
			id: qapLines.id,
			qty: qapLines.qty,
			currentDn: qapLines.currentDn,
			marginPct: qapLines.marginPct,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(inArray(qapLines.id, qapIds));
	const freshById = new Map(fresh.map((f) => [f.id, f]));

	let refreshed = 0;
	for (const l of lines) {
		if (!l.qapLineId) continue;
		const f = freshById.get(l.qapLineId);
		if (!f) continue;
		await db
			.update(budgetLines)
			.set({
				typeNameSnapshot: f.typeName,
				catalogNoSnapshot: f.catalogNo,
				manufacturerNameSnapshot: f.manufacturer,
				descriptionSnapshot: f.description,
				qtySnapshot: f.qty,
				currentDnSnapshot: f.currentDn,
				marginPctSnapshot: f.marginPct,
				qty: f.qty,
				unitDn: f.currentDn
			})
			.where(eq(budgetLines.id, l.id));
		refreshed++;
	}

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	return { refreshed };
}

// ---------------------------------------------------------------------------
// Mark sent / confirmed / archived
// ---------------------------------------------------------------------------

export async function setBudgetStatus(
	projectId: string,
	budgetId: string,
	status: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	if (!['draft', 'sent', 'confirmed', 'archived'].includes(status))
		return { error: 'Invalid status' };

	await db
		.update(budgets)
		.set({ status, updatedAt: new Date() })
		.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	revalidatePath(`/projects/${projectId}/budgets`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Clone — make a new budget by copying an existing one's lines
// ---------------------------------------------------------------------------

export async function cloneBudget(
	projectId: string,
	sourceBudgetId: string
): Promise<void> {
	const user = await requireUser();
	const source = (await db.select().from(budgets).where(eq(budgets.id, sourceBudgetId)).limit(1))[0];
	if (!source) throw new Error('Source budget not found');

	const newNo = await nextBudgetNo();
	const [created] = await db
		.insert(budgets)
		.values({
			projectId,
			budgetNo: newNo,
			status: 'draft',
			description: source.description ? `${source.description} (copy)` : null,
			marginPct: source.marginPct,
			freightPct: source.freightPct,
			warehousingPct: source.warehousingPct,
			salesTaxPct: source.salesTaxPct,
			notes: source.notes,
			createdByUserId: user.id
		})
		.returning({ id: budgets.id });

	const sourceLines = await db
		.select()
		.from(budgetLines)
		.where(eq(budgetLines.budgetId, sourceBudgetId));

	if (sourceLines.length > 0) {
		await db.insert(budgetLines).values(
			sourceLines.map((l) => ({
				budgetId: created.id,
				qapLineId: l.qapLineId,
				typeNameSnapshot: l.typeNameSnapshot,
				catalogNoSnapshot: l.catalogNoSnapshot,
				manufacturerNameSnapshot: l.manufacturerNameSnapshot,
				descriptionSnapshot: l.descriptionSnapshot,
				qtySnapshot: l.qtySnapshot,
				qtyTypeSnapshot: l.qtyTypeSnapshot,
				currentDnSnapshot: l.currentDnSnapshot,
				marginPctSnapshot: l.marginPctSnapshot,
				qty: l.qty,
				unitDn: l.unitDn
			}))
		);
	}

	revalidatePath(`/projects/${projectId}/budgets`);
	redirect(`/projects/${projectId}/budgets/${created.id}`);
}

// silence unused-import lint
void sql;

// ---------------------------------------------------------------------------
// Send budget via email (PDF attached). Flips status to 'sent' on success.
// ---------------------------------------------------------------------------

export type SendBudgetResult = {
	ok?: boolean;
	error?: string;
	sentTo?: string[];
	redirectedTo?: string[];
};

export async function sendBudgetEmail(
	projectId: string,
	budgetId: string,
	recipientsRaw: string
): Promise<SendBudgetResult> {
	const me = await requireUser();
	const recipients = parseEmails(recipientsRaw);
	if (recipients.length === 0)
		return { error: 'At least one valid email recipient required.' };

	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) return { error: 'Project not found' };

	const budget = (
		await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, projectId)))
			.limit(1)
	)[0];
	if (!budget) return { error: 'Budget not found' };

	const client = project.clientCompanyId
		? (
				await db
					.select({ name: companies.name })
					.from(companies)
					.where(eq(companies.id, project.clientCompanyId))
					.limit(1)
			)[0]
		: null;

	const lines = await db
		.select()
		.from(budgetLines)
		.where(eq(budgetLines.budgetId, budgetId))
		.orderBy(budgetLines.manufacturerNameSnapshot, budgetLines.catalogNoSnapshot);
	if (lines.length === 0) return { error: 'Budget has no lines to send.' };

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	const margin = Number(budget.marginPct ?? 0);
	let subtotalDn = 0;
	const emailLines: DocEmailLine[] = lines.map((l) => {
		const qty = Number(l.qty ?? 0);
		const dn = Number(l.unitDn ?? 0);
		const lineDn = qty * dn;
		const lineCn = lineDn * (1 + margin / 100);
		subtotalDn += lineDn;
		return {
			c1: l.typeNameSnapshot,
			c2: l.catalogNoSnapshot,
			c3: l.manufacturerNameSnapshot,
			c4: l.descriptionSnapshot,
			c5: l.qty ? Number(l.qty).toLocaleString() : null,
			c6: lineCn > 0 ? usd.format(lineCn) : null
		};
	});

	const subtotalCn = subtotalDn * (1 + margin / 100);
	const freightPct = Number(budget.freightPct ?? 0);
	const freight = subtotalCn * (freightPct / 100);
	const warehousingPct = Number(budget.warehousingPct ?? 0);
	const warehousing = subtotalCn * (warehousingPct / 100);
	const salesTaxPct = Number(budget.salesTaxPct ?? 0);
	const taxableBase = subtotalCn + freight + warehousing;
	const tax = taxableBase * (salesTaxPct / 100);
	const grandTotal = taxableBase + tax;

	const appUrl = process.env.AUTH_URL ?? '';
	const docUrl = appUrl ? `${appUrl}/projects/${projectId}/budgets/${budgetId}` : '';

	const totalsLines = [
		{ label: 'DN Subtotal', value: usd.format(subtotalDn) },
		{ label: `CN Subtotal (${margin}%)`, value: usd.format(subtotalCn) },
		...(freight > 0 ? [{ label: `Freight (${freightPct}%)`, value: usd.format(freight) }] : []),
		...(warehousing > 0
			? [{ label: `Warehousing (${warehousingPct}%)`, value: usd.format(warehousing) }]
			: []),
		...(tax > 0 ? [{ label: `Tax (${salesTaxPct}%)`, value: usd.format(tax) }] : [])
	];

	const html = renderDocEmailHtml({
		docKindLabel: 'Budget',
		docNo: budget.budgetNo,
		projectName: project.name,
		recipientName: client?.name ?? null,
		pmName: me.name ?? null,
		pmEmail: me.email,
		customMessage: budget.description,
		columns: ['Type', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Line CN'],
		lines: emailLines,
		totalsLines,
		grandLabel: 'Budget Total',
		grandValue: usd.format(grandTotal),
		appUrl,
		docUrl,
		closing: 'Please review and confirm. Reach out with any line-by-line questions.'
	});
	const text = renderDocEmailText({
		docKindLabel: 'Budget',
		docNo: budget.budgetNo,
		projectName: project.name,
		recipientName: client?.name ?? null,
		pmName: me.name ?? null,
		pmEmail: me.email,
		customMessage: budget.description,
		columns: ['Type', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Line CN'],
		lines: emailLines,
		totalsLines,
		grandLabel: 'Budget Total',
		grandValue: usd.format(grandTotal),
		appUrl,
		docUrl,
		closing: 'Please review and confirm. Reach out with any line-by-line questions.'
	});

	const pdfData: BudgetPdfData = {
		budgetNo: budget.budgetNo,
		status: budget.status,
		description: budget.description,
		createdAt: budget.createdAt.toISOString(),
		updatedAt: budget.updatedAt.toISOString(),
		marginPct: budget.marginPct,
		freightPct: budget.freightPct,
		warehousingPct: budget.warehousingPct,
		salesTaxPct: budget.salesTaxPct,
		projectName: project.name,
		clientCompany: client?.name ?? null,
		totalSf: project.totalSf,
		targetBudget: project.targetBudgetTotal,
		targetDollarsPerSf: project.targetDollarsPerSf,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qty,
			unitDn: l.unitDn
		}))
	};
	const pdfBuffer = await renderBudgetPdf(pdfData);

	const result = await sendEmail({
		to: recipients,
		replyTo: me.email,
		subject: `Budget ${budget.budgetNo} — ${project.name}${budget.description ? ` (${budget.description})` : ''}`,
		html,
		text,
		attachments: [{ filename: `${budget.budgetNo}.pdf`, content: pdfBuffer }]
	});

	if (!result.ok) return { error: result.error ?? 'Email send failed' };

	if (budget.status === 'draft') {
		await db
			.update(budgets)
			.set({ status: 'sent', updatedAt: new Date() })
			.where(eq(budgets.id, budgetId));
	}

	revalidatePath(`/projects/${projectId}/budgets/${budgetId}`);
	revalidatePath(`/projects/${projectId}/budgets`);

	return { ok: true, sentTo: recipients, redirectedTo: result.redirectedTo };
}
