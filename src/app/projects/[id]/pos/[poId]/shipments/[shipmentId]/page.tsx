import { db } from '@/lib/db';
import {
	shipments,
	shipmentLines,
	purchaseOrders,
	orderLines,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ShipmentDetailClient from './ShipmentDetailClient';

export default async function ShipmentDetailPage({
	params
}: {
	params: Promise<{ id: string; poId: string; shipmentId: string }>;
}) {
	const { id, poId, shipmentId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const poRow = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!poRow) notFound();

	const shipRow = (
		await db
			.select({
				s: shipments,
				creatorEmail: users.email
			})
			.from(shipments)
			.leftJoin(users, eq(shipments.createdByUserId, users.id))
			.where(and(eq(shipments.id, shipmentId), eq(shipments.purchaseOrderId, poId)))
			.limit(1)
	)[0];
	if (!shipRow) notFound();
	const s = shipRow.s;

	// Every order_line on this PO. We need: line metadata, qty ordered, what's
	// shipped on THIS shipment, and what's shipped on OTHER (non-cancelled)
	// shipments so the PM can see how much is already committed elsewhere.

	const lines = await db
		.select({
			id: orderLines.id,
			type: orderLines.typeNameSnapshot,
			catalogNo: orderLines.catalogNoSnapshot,
			manufacturer: orderLines.manufacturerNameSnapshot,
			description: orderLines.descriptionSnapshot,
			qty: orderLines.qty,
			qtyType: orderLines.qtyType,
			unitDn: orderLines.unitDn,
			thisShipmentQty: sql<string>`coalesce((SELECT ${shipmentLines.qtyShipped} FROM ${shipmentLines} WHERE ${shipmentLines.shipmentId} = ${shipmentId} AND ${shipmentLines.orderLineId} = ${orderLines.id} LIMIT 1), '')`,
			thisShipmentNotes: sql<string | null>`(SELECT ${shipmentLines.notes} FROM ${shipmentLines} WHERE ${shipmentLines.shipmentId} = ${shipmentId} AND ${shipmentLines.orderLineId} = ${orderLines.id} LIMIT 1)`,
			otherShipmentsQty: sql<string>`coalesce((SELECT sum(${shipmentLines.qtyShipped}) FROM ${shipmentLines} INNER JOIN ${shipments} ON ${shipments.id} = ${shipmentLines.shipmentId} WHERE ${shipmentLines.orderLineId} = ${orderLines.id} AND ${shipmentLines.shipmentId} != ${shipmentId} AND ${shipments.status} != 'cancelled'), 0)`,
			otherReceivedQty: sql<string>`coalesce((SELECT sum(${shipmentLines.qtyShipped}) FROM ${shipmentLines} INNER JOIN ${shipments} ON ${shipments.id} = ${shipmentLines.shipmentId} WHERE ${shipmentLines.orderLineId} = ${orderLines.id} AND ${shipmentLines.shipmentId} != ${shipmentId} AND ${shipments.status} = 'received'), 0)`
		})
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId))
		.orderBy(orderLines.manufacturerNameSnapshot, orderLines.typeNameSnapshot, orderLines.catalogNoSnapshot);

	const safeLines = lines.map((l) => ({
		id: l.id,
		type: l.type,
		catalogNo: l.catalogNo,
		manufacturer: l.manufacturer,
		description: l.description,
		qty: l.qty,
		qtyType: l.qtyType,
		unitDn: l.unitDn,
		thisShipmentQty: l.thisShipmentQty,
		thisShipmentNotes: l.thisShipmentNotes,
		otherShipmentsQty: l.otherShipmentsQty,
		otherReceivedQty: l.otherReceivedQty
	}));

	return (
		<ShipmentDetailClient
			projectId={project.id}
			projectName={project.name}
			poId={poRow.po.id}
			poNo={poRow.po.poNo}
			repFirm={poRow.repFirm}
			shipment={{
				id: s.id,
				shipmentNo: s.shipmentNo,
				status: s.status,
				carrier: s.carrier,
				trackingNumber: s.trackingNumber,
				expectedDate: s.expectedDate?.toISOString() ?? null,
				shippedDate: s.shippedDate?.toISOString() ?? null,
				receivedDate: s.receivedDate?.toISOString() ?? null,
				receivedAtLocation: s.receivedAtLocation,
				notes: s.notes,
				internalNotes: s.internalNotes,
				rowVersion: Number(s.rowVersion),
				createdAt: s.createdAt.toISOString(),
				creatorEmail: shipRow.creatorEmail
			}}
			lines={safeLines}
		/>
	);
}
