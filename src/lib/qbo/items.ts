import 'server-only';
import { db } from '@/lib/db';
import { products, companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { qboQuery, qboPost, getActiveQboConnection } from './client';

/**
 * Look up or create a QBO Item for an Ebisu product, then return the QBO
 * Item ID. Idempotent:
 *   1. If the product already has qbo_item_id stored, return it
 *   2. Else, query QBO by Name (catalog #) for an existing Item
 *   3. Else, create a new Item with the connection's default income +
 *      cogs account refs (REQUIRED by QBO — this is what tripped up Tadabase)
 *   4. Store the resulting Item ID on the product row
 *
 * Name format: catalog # — that's the natural QBO Item name. Description
 * carries the manufacturer + Ebisu description.
 */
export async function getOrCreateQboItem(productId: string): Promise<string> {
	const product = (
		await db.select().from(products).where(eq(products.id, productId)).limit(1)
	)[0];
	if (!product) throw new Error(`Product ${productId} not found`);
	if (product.qboItemId) return product.qboItemId;

	const conn = await getActiveQboConnection();
	if (!conn) throw new Error('No active QBO connection');
	if (!conn.defaultIncomeAccountId || !conn.defaultCogsAccountId) {
		throw new Error(
			'QBO connection is missing default income / COGS account references. ' +
				'Pick them at /qbo before pushing.'
		);
	}

	const manufacturerName = product.manufacturerCompanyId
		? (
				await db
					.select({ name: companies.name })
					.from(companies)
					.where(eq(companies.id, product.manufacturerCompanyId))
					.limit(1)
			)[0]?.name ?? null
		: null;

	const name = product.catalogNo;
	const escaped = name.replace(/'/g, "\\'");

	// 1. Look up by name (case-sensitive in QBO)
	const found = await qboQuery<{ QueryResponse?: { Item?: Array<{ Id: string; Name: string }> } }>(
		`SELECT Id, Name FROM Item WHERE Name = '${escaped}' MAXRESULTS 5`
	);
	const existing = found.QueryResponse?.Item?.[0];
	if (existing) {
		await db
			.update(products)
			.set({ qboItemId: existing.Id, qboStatus: 'pushed', qboPushedAt: new Date(), updatedAt: new Date() })
			.where(eq(products.id, productId));
		return existing.Id;
	}

	// 2. Create a new Item — IncomeAccountRef + ExpenseAccountRef both
	//    required for type=NonInventory (the lighter QBO Item type that doesn't
	//    track stock — we don't need stock tracking, we track delivery
	//    ourselves on shipments)
	const description = [manufacturerName, product.description].filter(Boolean).join(' — ');
	const body = {
		Name: name,
		Type: 'NonInventory',
		IncomeAccountRef: {
			value: conn.defaultIncomeAccountId,
			name: conn.defaultIncomeAccountName ?? undefined
		},
		ExpenseAccountRef: {
			value: conn.defaultCogsAccountId,
			name: conn.defaultCogsAccountName ?? undefined
		},
		Description: description || undefined,
		Active: true
	};

	let created: { Item: { Id: string } };
	try {
		created = await qboPost<{ Item: { Id: string } }>('/item?minorversion=70', body);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await db
			.update(products)
			.set({ qboStatus: 'failed', qboLastError: msg, updatedAt: new Date() })
			.where(eq(products.id, productId));
		throw err;
	}

	const itemId = created.Item.Id;
	await db
		.update(products)
		.set({
			qboItemId: itemId,
			qboStatus: 'pushed',
			qboPushedAt: new Date(),
			qboLastError: null,
			updatedAt: new Date()
		})
		.where(eq(products.id, productId));

	return itemId;
}
