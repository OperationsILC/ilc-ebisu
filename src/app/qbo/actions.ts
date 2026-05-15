'use server';

import { db } from '@/lib/db';
import { qboConnections } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { qboQuery, QboNotConnectedError } from '@/lib/qbo/client';
import { getQboEnvironment } from '@/lib/qbo/env';

/**
 * Fetch the list of Income / Expense / COGS accounts from QBO. Used to
 * populate the dropdowns on the /qbo settings page so the PM can pick which
 * account new Items default to.
 */
export type QboAccount = {
	Id: string;
	Name: string;
	AccountType: string;
	AccountSubType?: string;
	Active: boolean;
};

export async function fetchQboAccounts(): Promise<{
	income: QboAccount[];
	cogs: QboAccount[];
	error?: string;
}> {
	await requireUser();
	try {
		const incomeRes = await qboQuery<{ QueryResponse: { Account?: QboAccount[] } }>(
			"SELECT Id, Name, AccountType, AccountSubType, Active FROM Account WHERE AccountType = 'Income' AND Active = true MAXRESULTS 100"
		);
		const cogsRes = await qboQuery<{ QueryResponse: { Account?: QboAccount[] } }>(
			"SELECT Id, Name, AccountType, AccountSubType, Active FROM Account WHERE AccountType IN ('Cost of Goods Sold', 'Expense') AND Active = true MAXRESULTS 100"
		);
		return {
			income: incomeRes.QueryResponse?.Account ?? [],
			cogs: cogsRes.QueryResponse?.Account ?? []
		};
	} catch (err) {
		if (err instanceof QboNotConnectedError) {
			return { income: [], cogs: [], error: 'Not connected to QBO.' };
		}
		return {
			income: [],
			cogs: [],
			error: err instanceof Error ? err.message : String(err)
		};
	}
}

/**
 * Save the Income / COGS account defaults on the current active connection.
 * Required for Item creation to succeed.
 */
export async function saveQboDefaultAccounts(
	incomeAccountId: string,
	incomeAccountName: string,
	cogsAccountId: string,
	cogsAccountName: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const env = getQboEnvironment();

	const conn = (
		await db
			.select()
			.from(qboConnections)
			.where(and(eq(qboConnections.environment, env), isNull(qboConnections.disconnectedAt)))
			.limit(1)
	)[0];
	if (!conn) return { error: 'No active QBO connection.' };

	await db
		.update(qboConnections)
		.set({
			defaultIncomeAccountId: incomeAccountId,
			defaultIncomeAccountName: incomeAccountName,
			defaultCogsAccountId: cogsAccountId,
			defaultCogsAccountName: cogsAccountName,
			updatedAt: new Date()
		})
		.where(eq(qboConnections.id, conn.id));

	revalidatePath('/qbo');
	return { ok: true };
}

/**
 * Test the connection — fetches the CompanyInfo and returns the company name.
 * Verifies tokens + the connected realm.
 */
export async function pingQboCompany(): Promise<{
	ok?: boolean;
	error?: string;
	companyName?: string;
}> {
	await requireUser();
	try {
		const res = await qboQuery<{
			QueryResponse: { CompanyInfo?: Array<{ CompanyName: string; LegalName?: string }> };
		}>('SELECT * FROM CompanyInfo');
		const info = res.QueryResponse?.CompanyInfo?.[0];
		return {
			ok: true,
			companyName: info?.CompanyName ?? info?.LegalName ?? '(unnamed company)'
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : String(err)
		};
	}
}
