import { Document, Page, View, Text } from '@react-pdf/renderer';
import {
	styles,
	DocHeader,
	ToFromBlock,
	MetaStrip,
	LinesTable,
	TotalsBox,
	Footer,
	fmtUsd,
	fmtNum,
	fmtDate,
	type LineCol
} from './primitives';
import { ILC_OFFICE_DEFAULT } from './theme';

export type BudgetPdfLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	unitDn: string | null;
};

export type BudgetPdfData = {
	budgetNo: string;
	status: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;

	marginPct: string | null;
	freightPct: string | null;
	warehousingPct: string | null;
	salesTaxPct: string | null;

	projectName: string;
	clientCompany: string | null;
	totalSf: number | null;
	targetBudget: string | null;
	targetDollarsPerSf: string | null;

	lines: BudgetPdfLine[];
};

const COLUMNS: LineCol[] = [
	{ header: 'Type', width: 8 },
	{ header: 'Catalog #', width: 18 },
	{ header: 'Manufacturer', width: 14 },
	{ header: 'Description', width: 36, muted: true },
	{ header: 'Qty', width: 6, align: 'right' },
	{ header: 'Unit DN', width: 9, align: 'right' },
	{ header: 'Line CN', width: 9, align: 'right' }
];

export function BudgetPdf({ data }: { data: BudgetPdfData }) {
	const margin = Number(data.marginPct ?? 0);
	let subtotalDn = 0;
	const rows = data.lines.map((l) => {
		const qty = Number(l.qty ?? 0);
		const dn = Number(l.unitDn ?? 0);
		const lineDn = qty * dn;
		const lineCn = lineDn * (1 + margin / 100);
		subtotalDn += lineDn;
		return [
			l.type ?? '',
			l.catalogNo ?? '',
			l.manufacturer ?? '',
			l.description ?? '',
			l.qty ? fmtNum(qty) : '',
			l.unitDn ? fmtUsd(dn) : '',
			lineCn > 0 ? fmtUsd(lineCn) : ''
		];
	});

	const subtotalCn = subtotalDn * (1 + margin / 100);
	const freightPct = Number(data.freightPct ?? 0);
	const freight = subtotalCn * (freightPct / 100);
	const warehousingPct = Number(data.warehousingPct ?? 0);
	const warehousing = subtotalCn * (warehousingPct / 100);
	const salesTaxPct = Number(data.salesTaxPct ?? 0);
	const taxableBase = subtotalCn + freight + warehousing;
	const tax = taxableBase * (salesTaxPct / 100);
	const grandTotal = taxableBase + tax;

	const totalSf = Number(data.totalSf ?? 0);
	const dollarsPerSf = totalSf > 0 ? grandTotal / totalSf : 0;
	const targetBudget = Number(data.targetBudget ?? 0);
	const vsTarget = targetBudget > 0 ? grandTotal - targetBudget : null;

	const toLines = [data.clientCompany ?? '(client TBD)'];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		ILC_OFFICE_DEFAULT.address,
		ILC_OFFICE_DEFAULT.cityStateZip,
		ILC_OFFICE_DEFAULT.email
	];

	return (
		<Document
			title={`${data.budgetNo} — ILC Studios Budget`}
			author="ILC Studios"
			subject={`Budget ${data.budgetNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title="Budget"
					docNo={data.budgetNo}
					dateLabel="As of"
					dateValue={fmtDate(data.updatedAt)}
				/>

				<ToFromBlock
					to={{ label: 'For', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'Budget #', value: data.budgetNo },
						{ label: 'Project', value: data.projectName },
						{ label: 'Description', value: data.description },
						{ label: 'Status', value: data.status.toUpperCase() },
						{
							label: 'Total SF',
							value: totalSf > 0 ? totalSf.toLocaleString() : undefined
						},
						{ label: 'Margin', value: `${margin}%` }
					]}
				/>

				<Text style={styles.h2}>Line items</Text>
				<LinesTable columns={COLUMNS} rows={rows} />

				<TotalsBox
					rows={[
						{ label: 'DN Subtotal', value: fmtUsd(subtotalDn) },
						{ label: `CN Subtotal (${margin}%)`, value: fmtUsd(subtotalCn) },
						...(freight > 0
							? [{ label: `Freight (${freightPct}%)`, value: fmtUsd(freight) }]
							: []),
						...(warehousing > 0
							? [{ label: `Warehousing (${warehousingPct}%)`, value: fmtUsd(warehousing) }]
							: []),
						...(tax > 0
							? [{ label: `Tax (${salesTaxPct}%)`, value: fmtUsd(tax) }]
							: [])
					]}
					grand={{ label: 'Budget Total', value: fmtUsd(grandTotal) }}
				/>

				{(totalSf > 0 || vsTarget !== null) && (
					<View
						style={{
							marginTop: 12,
							padding: 10,
							backgroundColor: '#fafafa',
							borderRadius: 4,
							alignSelf: 'flex-end',
							minWidth: 280
						}}
					>
						{totalSf > 0 && (
							<View
								style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}
							>
								<Text style={{ fontSize: 9 }}>$/SF (across {fmtNum(totalSf)} SF)</Text>
								<Text style={{ fontSize: 9, fontWeight: 'bold' }}>{fmtUsd(dollarsPerSf)}</Text>
							</View>
						)}
						{data.targetDollarsPerSf && (
							<View
								style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}
							>
								<Text style={{ fontSize: 9 }}>Target $/SF</Text>
								<Text style={{ fontSize: 9, fontWeight: 'bold' }}>
									{fmtUsd(Number(data.targetDollarsPerSf))}
								</Text>
							</View>
						)}
						{vsTarget !== null && (
							<View
								style={{
									flexDirection: 'row',
									justifyContent: 'space-between',
									paddingVertical: 2,
									marginTop: 4,
									borderTopWidth: 0.5,
									borderTopColor: '#ccc',
									paddingTop: 4
								}}
							>
								<Text style={{ fontSize: 10, fontWeight: 'bold' }}>vs target budget</Text>
								<Text
									style={{
										fontSize: 10,
										fontWeight: 'bold',
										color: vsTarget > 0 ? '#7a1212' : '#0a7c2f'
									}}
								>
									{vsTarget > 0 ? '+' : ''}
									{fmtUsd(vsTarget)}
								</Text>
							</View>
						)}
					</View>
				)}

				<Footer
					left={[
						ILC_OFFICE_DEFAULT.name,
						ILC_OFFICE_DEFAULT.address + ' · ' + ILC_OFFICE_DEFAULT.cityStateZip,
						ILC_OFFICE_DEFAULT.email
					]}
					right={[`Budget ${data.budgetNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
