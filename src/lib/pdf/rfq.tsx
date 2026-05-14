import { Document, Page, View, Text } from '@react-pdf/renderer';
import {
	styles,
	DocHeader,
	ToFromBlock,
	MetaStrip,
	CustomMessage,
	LinesTable,
	Footer,
	fmtNum,
	fmtDate,
	type LineCol
} from './primitives';
import { ILC_OFFICE_DEFAULT } from './theme';

export type RfqPdfLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qty: string | null;
	qtyType: string | null;
};

export type RfqPdfData = {
	rfqNo: string;
	status: string;
	createdAt: string;
	sentAt: string | null;
	notes: string | null;

	projectName: string;

	repFirm: string | null;
	repFirmQuoteEmails: string | null;

	pmName: string | null;
	pmEmail: string | null;

	lines: RfqPdfLine[];
};

const RFQ_COLUMNS: LineCol[] = [
	{ header: 'Type', width: 10 },
	{ header: 'Catalog #', width: 22 },
	{ header: 'Manufacturer', width: 18 },
	{ header: 'Description', width: 38, muted: true },
	{ header: 'Qty', width: 6, align: 'right' },
	{ header: 'UoM', width: 6, align: 'left' }
];

export function RfqPdf({ data }: { data: RfqPdfData }) {
	const rows = data.lines.map((l) => [
		l.type ?? '',
		l.catalogNo ?? '',
		l.manufacturer ?? '',
		l.description ?? '',
		l.qty ? fmtNum(Number(l.qty)) : '',
		l.qtyType ?? ''
	]);

	const toLines = [
		data.repFirm ?? '(no rep firm assigned)',
		data.repFirmQuoteEmails ?? null
	];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		data.pmName ?? '',
		data.pmEmail ?? ILC_OFFICE_DEFAULT.email
	];

	return (
		<Document
			title={`${data.rfqNo} — ILC Studios Request for Quote`}
			author="ILC Studios"
			subject={`RFQ ${data.rfqNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title="Request for Quote"
					docNo={data.rfqNo}
					dateLabel="Date"
					dateValue={fmtDate(data.sentAt ?? data.createdAt)}
				/>

				<ToFromBlock
					to={{ label: 'To', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'RFQ #', value: data.rfqNo },
						{ label: 'Project', value: data.projectName },
						{ label: 'Status', value: data.status.toUpperCase() },
						{ label: 'Sent', value: fmtDate(data.sentAt) || undefined }
					]}
				/>

				<CustomMessage message={data.notes} />

				<Text style={styles.h2}>Items requested</Text>
				<LinesTable columns={RFQ_COLUMNS} rows={rows} />

				<View style={{ marginTop: 16, padding: 10, backgroundColor: '#fafafa' }}>
					<Text style={[styles.bodyText, { fontWeight: 'bold' }]}>
						Please quote dealer-net pricing per line and reply by email to{' '}
						{data.pmEmail ?? ILC_OFFICE_DEFAULT.email}.
					</Text>
					<Text style={[styles.bodyText, styles.muted, { marginTop: 4 }]}>
						Include lead time, freight terms, and quote validity. Reference{' '}
						{data.rfqNo} in your reply.
					</Text>
				</View>

				<Footer
					left={[
						ILC_OFFICE_DEFAULT.name,
						ILC_OFFICE_DEFAULT.address,
						ILC_OFFICE_DEFAULT.email + ' · ' + ILC_OFFICE_DEFAULT.website
					]}
					right={[`RFQ ${data.rfqNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
