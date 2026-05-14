import { Document, Page, View, Text } from '@react-pdf/renderer';
import {
	styles,
	DocHeader,
	ToFromBlock,
	MetaStrip,
	CustomMessage,
	LinesTable,
	TotalsBox,
	Footer,
	fmtUsd,
	fmtNum,
	fmtDate,
	type LineCol
} from './primitives';
import { ILC_OFFICE_DEFAULT } from './theme';

export type PoPdfLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
	unitDn: string | null;
	repQuoteNo: string | null;
};

export type PoPdfData = {
	poNo: string;
	status: string;
	versionNo: number;
	orderedDate: string | null;
	sentAt: string | null;
	createdAt: string;
	description: string | null;
	notes: string | null; // visible-to-rep notes (NOT internal_notes)
	customEmailMessage: string | null;
	addedFreight: string | null;
	repQuoteNo: string | null; // PO-level override
	trackingNumber: string | null;
	shipToText: string | null;
	ilcOfficeAddress: string | null;
	sendFromEmail: string | null;
	sendToEmail: string | null;

	projectName: string;
	soNo: string | null;

	repFirm: string | null;
	repFirmOrderEmails: string | null;

	deliveryAddress: string | null; // project's default delivery (fallback)
	lines: PoPdfLine[];
};

const PO_COLUMNS: LineCol[] = [
	{ header: 'Type', width: 8 },
	{ header: 'Catalog #', width: 16 },
	{ header: 'Manufacturer', width: 14 },
	{ header: 'Description', width: 28, muted: true },
	{ header: 'Qty', width: 6, align: 'right' },
	{ header: 'UoM', width: 6, align: 'left' },
	{ header: 'Unit DN', width: 10, align: 'right' },
	{ header: 'Line Total', width: 12, align: 'right' }
];

export function PoPdf({ data }: { data: PoPdfData }) {
	// Compute line totals + grand totals.
	let subtotal = 0;
	const rows = data.lines.map((l) => {
		const qty = Number(l.qty ?? 0);
		const dn = Number(l.unitDn ?? 0);
		const lineTotal = qty * dn;
		subtotal += lineTotal;
		return [
			l.type ?? '',
			l.catalogNo ?? '',
			l.manufacturer ?? '',
			l.description ?? '',
			l.qty ? fmtNum(qty) : '',
			l.qtyType ?? '',
			l.unitDn ? fmtUsd(dn) : '',
			lineTotal > 0 ? fmtUsd(lineTotal) : ''
		];
	});
	const addedFreight = Number(data.addedFreight ?? 0);
	const grandTotal = subtotal + addedFreight;

	// Compose "to" / "from" address blocks.
	const toLines = [
		data.repFirm ?? '(no rep firm assigned)',
		data.sendToEmail ?? data.repFirmOrderEmails ?? null
	];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		...(data.ilcOfficeAddress
			? data.ilcOfficeAddress.split('\n')
			: [ILC_OFFICE_DEFAULT.address, ILC_OFFICE_DEFAULT.cityStateZip]),
		data.sendFromEmail ?? ILC_OFFICE_DEFAULT.email
	];

	const shipTo = data.shipToText?.trim() || data.deliveryAddress?.trim() || null;

	return (
		<Document
			title={`${data.poNo} — ILC Studios Purchase Order`}
			author="ILC Studios"
			subject={`Purchase Order ${data.poNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title="Purchase Order"
					docNo={data.poNo}
					dateLabel="Date"
					dateValue={fmtDate(data.orderedDate ?? data.sentAt ?? data.createdAt)}
				/>

				<ToFromBlock
					to={{ label: 'To', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'PO #', value: data.poNo },
						{ label: 'Project', value: data.projectName },
						{ label: 'SO ref', value: data.soNo },
						{
							label: 'Rep quote #',
							value: data.repQuoteNo
						},
						{ label: 'Status', value: data.status.toUpperCase() },
						{ label: 'Version', value: `v${data.versionNo}` },
						{
							label: 'Ordered',
							value: fmtDate(data.orderedDate) || undefined
						},
						{ label: 'Sent', value: fmtDate(data.sentAt) || undefined },
						{
							label: 'Tracking #',
							value: data.trackingNumber
						}
					]}
				/>

				<CustomMessage message={data.customEmailMessage} />

				<Text style={styles.h2}>Items ordered</Text>
				<LinesTable columns={PO_COLUMNS} rows={rows} />

				<TotalsBox
					rows={[
						{ label: 'Subtotal', value: fmtUsd(subtotal) },
						{ label: 'Added freight', value: fmtUsd(addedFreight) }
					]}
					grand={{ label: 'PO Total', value: fmtUsd(grandTotal) }}
				/>

				{shipTo && (
					<>
						<Text style={styles.h2}>Ship to</Text>
						<View style={{ marginBottom: 12 }}>
							{shipTo.split('\n').map((line, i) => (
								<Text key={i} style={styles.bodyText}>
									{line}
								</Text>
							))}
						</View>
					</>
				)}

				{data.notes && (
					<>
						<Text style={styles.h2}>Notes</Text>
						<View style={{ marginBottom: 12 }}>
							<Text style={styles.bodyText}>{data.notes}</Text>
						</View>
					</>
				)}

				{data.description && (
					<>
						<Text style={styles.h2}>Description</Text>
						<View style={{ marginBottom: 12 }}>
							<Text style={styles.bodyText}>{data.description}</Text>
						</View>
					</>
				)}

				<Footer
					left={[
						ILC_OFFICE_DEFAULT.name,
						data.ilcOfficeAddress?.split('\n')[0] ?? ILC_OFFICE_DEFAULT.address,
						ILC_OFFICE_DEFAULT.email + ' · ' + ILC_OFFICE_DEFAULT.website
					]}
					right={[`PO ${data.poNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
