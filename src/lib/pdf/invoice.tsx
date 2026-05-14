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

export type InvoicePdfLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	designFeeDescription: string | null;
	qty: string | null;
	qtyType: string | null;
	unitCn: string | null;
	lineTotal: string | null;
};

export type InvoicePdfData = {
	invoiceNo: string;
	type: 'product' | 'design_fee' | 'credit_memo' | string;
	status: string;
	invoiceDate: string | null;
	dueDate: string | null;
	clientPoNo: string | null;
	designPhase: string | null;
	salesTaxPct: string | null;
	salesTaxName: string | null;
	depositAppliedAmount: string | null;
	creditAppliedAmount: string | null;
	totalAmount: string | null;
	amountDue: string | null;

	projectName: string;
	clientCompany: string | null;
	clientPoProjectNo: string | null; // project-level client PO

	soNo: string | null;

	lines: InvoicePdfLine[];
};

const PRODUCT_COLUMNS: LineCol[] = [
	{ header: 'Type', width: 8 },
	{ header: 'Catalog #', width: 18 },
	{ header: 'Manufacturer', width: 14 },
	{ header: 'Description', width: 34, muted: true },
	{ header: 'Qty', width: 6, align: 'right' },
	{ header: 'UoM', width: 6 },
	{ header: 'Unit', width: 8, align: 'right' },
	{ header: 'Total', width: 8, align: 'right' }
];

const FREEFORM_COLUMNS: LineCol[] = [
	{ header: 'Description', width: 70 },
	{ header: 'Qty', width: 8, align: 'right' },
	{ header: 'Unit', width: 11, align: 'right' },
	{ header: 'Total', width: 11, align: 'right' }
];

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
	const isProduct = data.type === 'product';
	const isCredit = data.type === 'credit_memo';

	let subtotal = 0;
	const rows = data.lines.map((l) => {
		const qty = Number(l.qty ?? 0);
		const unit = Number(l.unitCn ?? 0);
		const lineTotal = Number(l.lineTotal ?? qty * unit);
		subtotal += lineTotal;

		if (isProduct) {
			return [
				l.type ?? '',
				l.catalogNo ?? '',
				l.manufacturer ?? '',
				l.description ?? '',
				l.qty ? fmtNum(qty) : '',
				l.qtyType ?? '',
				l.unitCn ? fmtUsd(unit) : '',
				lineTotal !== 0 ? fmtUsd(lineTotal) : ''
			];
		}
		return [
			l.designFeeDescription ?? l.description ?? '',
			l.qty ? fmtNum(qty) : '',
			l.unitCn ? fmtUsd(unit) : '',
			lineTotal !== 0 ? fmtUsd(lineTotal) : ''
		];
	});

	const taxPct = Number(data.salesTaxPct ?? 0);
	const taxAmt = isProduct ? subtotal * (taxPct / 100) : 0;
	const total = Number(data.totalAmount ?? subtotal + taxAmt);
	const credit = Number(data.creditAppliedAmount ?? 0);
	const deposit = Number(data.depositAppliedAmount ?? 0);
	const due = Number(data.amountDue ?? Math.max(total - credit - deposit, 0));

	const toLines = [data.clientCompany ?? '(client TBD)'];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		ILC_OFFICE_DEFAULT.address,
		ILC_OFFICE_DEFAULT.cityStateZip,
		ILC_OFFICE_DEFAULT.email
	];

	const title =
		data.type === 'design_fee' ? 'Design Fee Invoice' : data.type === 'credit_memo' ? 'Credit Memo' : 'Invoice';

	return (
		<Document
			title={`${data.invoiceNo} — ILC Studios ${title}`}
			author="ILC Studios"
			subject={`${title} ${data.invoiceNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title={title}
					docNo={data.invoiceNo}
					dateLabel="Date"
					dateValue={fmtDate(data.invoiceDate)}
				/>

				<ToFromBlock
					to={{ label: 'Bill to', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'Invoice #', value: data.invoiceNo },
						{ label: 'Project', value: data.projectName },
						{ label: 'SO ref', value: data.soNo },
						{ label: 'Client PO #', value: data.clientPoNo ?? data.clientPoProjectNo },
						{ label: 'Phase', value: data.designPhase },
						{ label: 'Date', value: fmtDate(data.invoiceDate) || undefined },
						{ label: 'Due', value: fmtDate(data.dueDate) || undefined }
					]}
				/>

				<Text style={styles.h2}>{isCredit ? 'Credit items' : 'Items'}</Text>
				<LinesTable columns={isProduct ? PRODUCT_COLUMNS : FREEFORM_COLUMNS} rows={rows} />

				<TotalsBox
					rows={[
						{ label: 'Subtotal', value: fmtUsd(subtotal) },
						...(isProduct && taxAmt !== 0
							? [
									{
										label: `${data.salesTaxName ?? 'Sales tax'} (${taxPct}%)`,
										value: fmtUsd(taxAmt)
									}
								]
							: []),
						...(deposit > 0
							? [{ label: 'Deposit applied', value: '-' + fmtUsd(deposit) }]
							: []),
						...(credit > 0
							? [{ label: 'Credit applied', value: '-' + fmtUsd(credit) }]
							: [])
					]}
					grand={{ label: isCredit ? 'Credit total' : 'Amount due', value: fmtUsd(due) }}
				/>

				<View style={{ marginTop: 16, padding: 8, backgroundColor: '#fafafa' }}>
					<Text style={styles.bodyText}>
						{isCredit
							? 'This credit may be applied against any future invoice. Please contact ILC Studios with any questions.'
							: `Payment due ${fmtDate(data.dueDate) || 'upon receipt'}. Reference invoice ${data.invoiceNo} on payment. Thank you.`}
					</Text>
				</View>

				<Footer
					left={[
						ILC_OFFICE_DEFAULT.name,
						ILC_OFFICE_DEFAULT.address,
						ILC_OFFICE_DEFAULT.email + ' · ' + ILC_OFFICE_DEFAULT.website
					]}
					right={[`Invoice ${data.invoiceNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
