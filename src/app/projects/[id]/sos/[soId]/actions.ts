'use server';

import { db } from '@/lib/db';
import {
	salesOrders,
	purchaseOrders,
	orderLines,
	qapLines,
	projects,
	products,
	companies,
	companyRoles,
	types,
	manufacturerRep
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, count, inArray, sql, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';

// ---------------------------------------------------------------------------
// SO header edits
// ---------------------------------------------------------------------------

const SoHeaderSchema = z.object({
	status: z.string().optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	customEmailMessage: z.string().optional(),
	marginPct: z.string().optional(),
	freightPct: z.string().optional(),
	warehousingPct: z.string().optional(),
	salesTaxPct: z.string().optional(),
	salesTaxName: z.string().optional(),
	additionalFreight: z.string().optional(),
	freightOverride: z.string().optional()
});

export type SoHeaderResult = { ok?: boolean; error?: string };

export async function updateSoHeader(
	projectId: string,
	soId: string,
	_prev: SoHeaderResult | undefined,
	formData: FormData
): Promise<SoHeaderResult> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = SoHeaderSchema.safeParse(raw);
	if (!parsed.success) return { error: 'Invalid form data' };

	const v = parsed.data;
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	for (const k of [
		'status',
		'description',
		'notes',
		'customEmailMessage',
		'salesTaxName'
	] as const) {
		if (v[k] !== undefined) updates[k] = v[k].trim() === '' ? null : v[k].trim();
	}
	for (const k of [
		'marginPct',
		'freightPct',
		'warehousingPct',
		'salesTaxPct',
		'additionalFreight',
		'freightOverride'
	] as const) {
		if (v[k] !== undefined) {
			const t = v[k].trim();
			if (t === '') updates[k] = null;
			else if (Number.isFinite(Number(t))) updates[k] = t;
		}
	}

	await db
		.update(salesOrders)
		.set(updates)
		.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/sos/${soId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Add QAP lines to an SO (snapshots them; defaults unit_dn from QAP current_dn,
// unit_cn computed from SO margin)
// ---------------------------------------------------------------------------

export async function addQapLinesToSo(
	projectId: string,
	soId: string,
	qapLineIds: string[]
): Promise<{ added?: number; skipped?: number; error?: string }> {
	const user = await requireUser();
	if (qapLineIds.length === 0) return { error: 'No lines selected' };

	const so = (
		await db
			.select()
			.from(salesOrders)
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!so) return { error: 'SO not found' };

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
		return { error: 'Some lines do not belong to this project. Refresh and try again.' };
	}

	// Already-on-this-SO check (we don't enforce a unique constraint because PMs
	// might legitimately want a QAP line on the SO twice for different shipments,
	// but we soft-warn).
	const existing = await db
		.select({ qapLineId: orderLines.qapLineId })
		.from(orderLines)
		.where(and(eq(orderLines.salesOrderId, soId), inArray(orderLines.qapLineId, qapLineIds)));
	const existingSet = new Set(existing.map((e) => e.qapLineId));

	const soMargin = Number(so.marginPct ?? 0);

	let added = 0;
	let skipped = 0;
	for (const l of linesData) {
		if (existingSet.has(l.id)) {
			skipped++;
			continue;
		}
		const unitDn = l.currentDn;
		const lineMarginRaw = l.marginPct;
		const lineMargin = lineMarginRaw === null ? soMargin : Number(lineMarginRaw);
		const unitCn = unitDn === null ? null : String(Number(unitDn) * (1 + lineMargin / 100));

		await db.insert(orderLines).values({
			salesOrderId: soId,
			qapLineId: l.id,
			typeNameSnapshot: l.typeName,
			catalogNoSnapshot: l.catalogNo,
			manufacturerNameSnapshot: l.manufacturer,
			descriptionSnapshot: l.description,
			qty: l.qty,
			unitDn,
			unitCn,
			marginPct: lineMarginRaw,
			createdByUserId: user.id,
			updatedByUserId: user.id
		});
		added++;
	}

	revalidatePath(`/projects/${projectId}/sos/${soId}`);
	return { added, skipped };
}

// ---------------------------------------------------------------------------
// Save bulk line edits (qty / unit_dn / unit_cn / margin_pct / qty_type / rep_quote_no)
// ---------------------------------------------------------------------------

const LineEditSchema = z.object({
	id: z.string().uuid(),
	rowVersion: z.number(),
	fields: z.object({
		qty: z.string().optional(),
		qtyType: z.string().optional(),
		unitDn: z.string().optional(),
		unitCn: z.string().optional(),
		marginPct: z.string().optional(),
		repQuoteNo: z.string().optional()
	})
});
const SaveLineEditsSchema = z.object({ changes: z.array(LineEditSchema) });

const EDITABLE_NUMERIC = new Set(['qty', 'unitDn', 'unitCn', 'marginPct']);

export type SaveLineEditsResult = {
	accepted: { id: string; new_row_version: number }[];
	rejected: { id: string; reason: string }[];
	error?: string;
};

export async function saveOrderLineEdits(
	soId: string,
	payloadJson: string
): Promise<SaveLineEditsResult> {
	const user = await requireUser();
	let payload: z.infer<typeof SaveLineEditsSchema>;
	try {
		payload = SaveLineEditsSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { accepted: [], rejected: [], error: 'Invalid payload' };
	}

	const accepted: SaveLineEditsResult['accepted'] = [];
	const rejected: SaveLineEditsResult['rejected'] = [];

	for (const change of payload.changes) {
		const updates: Record<string, unknown> = {};
		const errors: string[] = [];
		for (const [k, v] of Object.entries(change.fields)) {
			if (v === undefined) continue;
			const t = String(v).trim();
			if (EDITABLE_NUMERIC.has(k)) {
				if (t === '') updates[k] = null;
				else if (Number.isFinite(Number(t))) updates[k] = t;
				else errors.push(`${k}: must be a number`);
			} else {
				// text fields (qtyType, repQuoteNo)
				updates[k] = t === '' ? null : t;
			}
		}
		if (errors.length > 0) {
			rejected.push({ id: change.id, reason: errors.join('; ') });
			continue;
		}
		if (Object.keys(updates).length === 0) continue;

		const current = (
			await db
				.select({ rv: orderLines.rowVersion })
				.from(orderLines)
				.where(and(eq(orderLines.id, change.id), eq(orderLines.salesOrderId, soId)))
				.limit(1)
		)[0];
		if (!current) {
			rejected.push({ id: change.id, reason: 'not_found' });
			continue;
		}
		if (Number(current.rv) !== change.rowVersion) {
			rejected.push({ id: change.id, reason: `stale_row_version (server is at v${current.rv})` });
			continue;
		}

		const result = await db
			.update(orderLines)
			.set({
				...updates,
				rowVersion: sql`${orderLines.rowVersion} + 1`,
				updatedAt: new Date(),
				updatedByUserId: user.id
			})
			.where(and(eq(orderLines.id, change.id), eq(orderLines.rowVersion, change.rowVersion)))
			.returning({ rv: orderLines.rowVersion });

		if (result.length === 0) {
			rejected.push({ id: change.id, reason: 'stale_row_version (race)' });
			continue;
		}
		accepted.push({ id: change.id, new_row_version: Number(result[0].rv) });
	}

	revalidatePath(`/projects/.+/sos/${soId}`, 'page');
	return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// Delete an order line from an SO (also removes it from the PO it was on)
// ---------------------------------------------------------------------------

export async function deleteOrderLine(
	projectId: string,
	soId: string,
	orderLineId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const result = await db
		.delete(orderLines)
		.where(and(eq(orderLines.id, orderLineId), eq(orderLines.salesOrderId, soId)))
		.returning({ id: orderLines.id });
	if (result.length === 0) return { error: 'Line not found' };
	revalidatePath(`/projects/${projectId}/sos/${soId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Create POs from SO: group order_lines by rep_firm and create one PO per
// rep_firm, attaching the lines via purchase_order_id.
// ---------------------------------------------------------------------------

export async function createPosFromSo(
	projectId: string,
	soId: string
): Promise<{ createdPos?: number; error?: string }> {
	const user = await requireUser();

	const so = (
		await db
			.select()
			.from(salesOrders)
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!so) return { error: 'SO not found' };

	// Lines that aren't yet on a PO.
	const lines = await db
		.select({
			id: orderLines.id,
			manufacturer: orderLines.manufacturerNameSnapshot
		})
		.from(orderLines)
		.where(
			and(eq(orderLines.salesOrderId, soId), isNull(orderLines.purchaseOrderId))
		);
	if (lines.length === 0) {
		return { error: 'All lines already on POs (or SO has no lines yet).' };
	}

	// Resolve each line's rep_firm: look up manufacturer_rep mapping; default to
	// LOGIQ SUPPLY when there's no mapping. If LOGIQ SUPPLY doesn't exist as a
	// rep_firm in companies/company_roles, group those as "unassigned" — PM
	// will resolve manually.

	// Pre-fetch all rep_firm-tagged companies for fast lookup
	const repFirms = await db
		.select({ companyId: companies.id, name: companies.name })
		.from(companies)
		.innerJoin(
			companyRoles,
			and(eq(companyRoles.companyId, companies.id), eq(companyRoles.role, 'rep_firm'))
		);
	const repFirmByName = new Map(repFirms.map((r) => [r.name, r.companyId]));
	const logiqId = repFirmByName.get('LOGIQ SUPPLY') ?? null;

	// Pre-fetch manufacturer_rep mappings (manufacturer_name → rep_firm_id)
	const mfrToRep = new Map<string, string>();
	if (lines.length > 0) {
		const mfrNames = [...new Set(lines.map((l) => l.manufacturer).filter((m): m is string => !!m))];
		if (mfrNames.length > 0) {
			const mappings = await db
				.select({
					mfrName: companies.name,
					repFirmId: manufacturerRep.repFirmCompanyId
				})
				.from(manufacturerRep)
				.innerJoin(companies, eq(manufacturerRep.manufacturerCompanyId, companies.id))
				.where(inArray(companies.name, mfrNames));
			for (const m of mappings) {
				if (m.mfrName && m.repFirmId) mfrToRep.set(m.mfrName, m.repFirmId);
			}
		}
	}

	// Bucket lines by resolved rep_firm_id (or 'unassigned')
	const buckets = new Map<string | null, string[]>();
	for (const l of lines) {
		const rep =
			(l.manufacturer && mfrToRep.get(l.manufacturer)) ?? logiqId ?? null;
		const arr = buckets.get(rep) ?? [];
		arr.push(l.id);
		buckets.set(rep, arr);
	}

	// Create one PO per bucket
	let createdPos = 0;
	for (const [repFirmId, lineIds] of buckets) {
		const [{ n: existing }] = await db.select({ n: count() }).from(purchaseOrders);
		const poNo = `PO${String(Number(existing) + 1 + createdPos).padStart(5, '0')}`;

		const [po] = await db
			.insert(purchaseOrders)
			.values({
				projectId,
				salesOrderId: soId,
				repFirmCompanyId: repFirmId,
				poNo,
				status: 'draft',
				createdByUserId: user.id
			})
			.returning({ id: purchaseOrders.id });

		await db
			.update(orderLines)
			.set({ purchaseOrderId: po.id, updatedAt: new Date() })
			.where(inArray(orderLines.id, lineIds));

		createdPos++;
	}

	revalidatePath(`/projects/${projectId}/sos/${soId}`);
	revalidatePath(`/projects/${projectId}/pos`);
	return { createdPos };
}
