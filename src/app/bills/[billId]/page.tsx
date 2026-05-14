import { db } from '@/lib/db';
import { bills, purchaseOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import UnmatchedBillClient from './UnmatchedBillClient';

/**
 * Fallback detail page for bills that haven't been matched to a project yet.
 * Once the PM attaches the bill to a PO, project_id auto-fills and subsequent
 * loads redirect into /projects/[id]/bills/[billId].
 */
export default async function UnmatchedBillPage({
	params
}: {
	params: Promise<{ billId: string }>;
}) {
	const { billId } = await params;

	const bill = (await db.select().from(bills).where(eq(bills.id, billId)).limit(1))[0];
	if (!bill) notFound();

	if (bill.projectId) {
		redirect(`/projects/${bill.projectId}/bills/${billId}`);
	}

	// List all POs in the system so the PM can pick. In real-world volume this
	// is fine — POs are bounded; if it ever becomes a problem we add a search.
	const allPos = await db
		.select({ id: purchaseOrders.id, poNo: purchaseOrders.poNo })
		.from(purchaseOrders)
		.orderBy(purchaseOrders.poNo);

	return (
		<UnmatchedBillClient
			bill={{
				id: bill.id,
				billNo: bill.billNo,
				vendorBillNo: bill.vendorBillNo,
				totalAmount: bill.totalAmount,
				sourcePdfUrl: bill.sourcePdfUrl,
				sourceParsedJson: bill.sourceParsedJson as Record<string, unknown> | null
			}}
			poOptions={allPos}
		/>
	);
}
