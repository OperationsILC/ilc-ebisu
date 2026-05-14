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

export type SoPdfLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
	unitCn: string | null;
};

export type SoPdfData = {
	soNo: string;
	status: string;
	createdAt: string;
	confirmedAt: string | null;
	sentAt: string | null;
	description: string | null;
	notes: string | null;
	customEmailMessage: string | null;

	// % overrides
	marginPct: string | null;
	freightPct: string | null;
	warehousingPct: string | null;
	salesTaxPct: string | null;
	salesTaxName: string | null;
	additionalFreight: string | null;
	freightOverride: string | null;

	projectName: string;
	clientCompany: string | null;
	gcCompany: string | null;
	projectMgrName: string | null;
	procurementMgrName: string | null;

	deliveryAddress: string | null;

	lines: SoPdfLine[];
};

const SO_COLUMNS: LineCol[] = [
	{ header: 'Type', width: 8 },
	{ header: 'Catalog #', width: 16 },
	{ header: 'Manufacturer', width: 14 },
	{ header: 'Description', width: 30, muted: true },
	{ header: 'Qty', width: 6, align: 'right' },
	{ header: 'UoM', width: 6, align: 'left' },
	{ header: 'Unit CN', width: 10, align: 'right' },
	{ header: 'Line Total', width: 10, align: 'right' }
];

export function SoPdf({ data }: { data: SoPdfData }) {
	let subtotal = 0;
	const rows = data.lines.map((l) => {
		const qty = Number(l.qty ?? 0);
		const cn = Number(l.unitCn ?? 0);
		const lineTotal = qty * cn;
		subtotal += lineTotal;
		return [
			l.type ?? '',
			l.catalogNo ?? '',
			l.manufacturer ?? '',
			l.description ?? '',
			l.qty ? fmtNum(qty) : '',
			l.qtyType ?? '',
			l.unitCn ? fmtUsd(cn) : '',
			lineTotal > 0 ? fmtUsd(lineTotal) : ''
		];
	});

	// SO totals: freight$ (override wins) → warehousing → tax → grand
	const freightOverride = data.freightOverride ? Number(data.freightOverride) : null;
	const freightPct = Number(data.freightPct ?? 0);
	const freightAmt =
		freightOverride !== null ? freightOverride : subtotal * (freightPct / 100);
	const addlFreight = Number(data.additionalFreight ?? 0);
	const freightTotal = freightAmt + addlFreight;
	const warehousingPct = Number(data.warehousingPct ?? 0);
	const warehousingAmt = subtotal * (warehousingPct / 100);
	const salesTaxPct = Number(data.salesTaxPct ?? 0);
	const taxableBase = subtotal + freightTotal + warehousingAmt;
	const salesTaxAmt = taxableBase * (salesTaxPct / 100);
	const grandTotal = taxableBase + salesTaxAmt;

	const toLines = [
		data.clientCompany ?? '(client TBD)',
		data.gcCompany ? `c/o ${data.gcCompany}` : null
	];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		data.procurementMgrName ?? data.projectMgrName ?? '',
		ILC_OFFICE_DEFAULT.email
	];

	return (
		<Document
			title={`${data.soNo} — ILC Studios Sales Order`}
			author="ILC Studios"
			subject={`Sales Order ${data.soNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title="Sales Order"
					docNo={data.soNo}
					dateLabel="Date"
					dateValue={fmtDate(data.confirmedAt ?? data.sentAt ?? data.createdAt)}
				/>

				<ToFromBlock
					to={{ label: 'For', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'SO #', value: data.soNo },
						{ label: 'Project', value: data.projectName },
						{ label: 'Status', value: data.status.toUpperCase() },
						{ label: 'Confirmed', value: fmtDate(data.confirmedAt) || undefined },
						{ label: 'Sent', value: fmtDate(data.sentAt) || undefined }
					]}
				/>

				<CustomMessage message={data.customEmailMessage} />

				<Text style={styles.h2}>Items</Text>
				<LinesTable columns={SO_COLUMNS} rows={rows} />

				<TotalsBox
					rows={[
						{ label: 'Subtotal (CN)', value: fmtUsd(subtotal) },
						{
							label:
								freightOverride !== null
									? 'Freight (override)'
									: `Freight (${freightPct}%)`,
							value: fmtUsd(freightAmt)
						},
						...(addlFreight > 0
							? [{ label: 'Additional freight', value: fmtUsd(addlFreight) }]
							: []),
						...(warehousingPct > 0
							? [
									{
										label: `Warehousing (${warehousingPct}%)`,
										value: fmtUsd(warehousingAmt)
									}
								]
							: []),
						...(salesTaxPct > 0
							? [
									{
										label: `${data.salesTaxName ?? 'Sales tax'} (${salesTaxPct}%)`,
										value: fmtUsd(salesTaxAmt)
									}
								]
							: [])
					]}
					grand={{ label: 'Total', value: fmtUsd(grandTotal) }}
				/>

				{data.deliveryAddress && (
					<>
						<Text style={styles.h2}>Deliver to</Text>
						<View style={{ marginBottom: 12 }}>
							{data.deliveryAddress.split('\n').map((line, i) => (
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
						ILC_OFFICE_DEFAULT.address,
						ILC_OFFICE_DEFAULT.email + ' · ' + ILC_OFFICE_DEFAULT.website
					]}
					right={[`SO ${data.soNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
