import { Document, Page, View, Text } from '@react-pdf/renderer';
import {
	styles,
	DocHeader,
	ToFromBlock,
	MetaStrip,
	CustomMessage,
	LinesTable,
	Footer,
	fmtUsd,
	fmtNum,
	fmtDate,
	type LineCol
} from './primitives';
import { ILC_OFFICE_DEFAULT } from './theme';

export type ChangeOrderPdfLine = {
	operation: string;
	catalogNoBefore: string | null;
	catalogNoAfter: string | null;
	descriptionBefore: string | null;
	descriptionAfter: string | null;
	qtyBefore: string | null;
	qtyAfter: string | null;
	qtyType: string | null;
	unitDnBefore: string | null;
	unitDnAfter: string | null;
	lineTotalDelta: string | null;
	reasonText: string | null;
};

export type ChangeOrderPdfData = {
	coNo: string;
	status: string;
	createdAt: string;
	sentAt: string | null;
	appliedAt: string | null;
	versionNoBefore: number;
	versionNoAfter: number | null;
	description: string | null;
	customEmailMessage: string | null;
	netAmountChange: string | null;

	projectName: string;
	poNo: string;
	repFirm: string | null;
	repFirmOrderEmails: string | null;

	pmName: string | null;
	pmEmail: string | null;

	lines: ChangeOrderPdfLine[];
};

const COLUMNS: LineCol[] = [
	{ header: 'Op', width: 8 },
	{ header: 'Catalog #', width: 18 },
	{ header: 'Description', width: 30, muted: true },
	{ header: 'Qty', width: 12, align: 'right' },
	{ header: 'Unit DN', width: 14, align: 'right' },
	{ header: 'Δ $', width: 10, align: 'right' },
	{ header: 'Reason', width: 8, muted: true }
];

function fmtBeforeAfter(before: string | null, after: string | null, op: string): string {
	if (op === 'add') return `+ ${after ?? ''}`;
	if (op === 'remove') return `(removed) ${before ?? ''}`;
	if (!before || !after || before === after) return after ?? before ?? '';
	return `${before} → ${after}`;
}

function fmtQtyBeforeAfter(
	before: string | null,
	after: string | null,
	op: string,
	qtyType: string | null
): string {
	const beforeNum = before ? fmtNum(Number(before)) : '';
	const afterNum = after ? fmtNum(Number(after)) : '';
	const result = fmtBeforeAfter(beforeNum || null, afterNum || null, op);
	return qtyType ? `${result} ${qtyType}` : result;
}

function fmtUsdBeforeAfter(
	before: string | null,
	after: string | null,
	op: string
): string {
	const b = before ? fmtUsd(Number(before)) : '';
	const a = after ? fmtUsd(Number(after)) : '';
	return fmtBeforeAfter(b || null, a || null, op);
}

export function ChangeOrderPdf({ data }: { data: ChangeOrderPdfData }) {
	const rows = data.lines.map((l) => [
		l.operation.toUpperCase(),
		fmtBeforeAfter(l.catalogNoBefore, l.catalogNoAfter, l.operation),
		fmtBeforeAfter(l.descriptionBefore, l.descriptionAfter, l.operation),
		fmtQtyBeforeAfter(l.qtyBefore, l.qtyAfter, l.operation, l.qtyType),
		fmtUsdBeforeAfter(l.unitDnBefore, l.unitDnAfter, l.operation),
		l.lineTotalDelta && Number(l.lineTotalDelta) !== 0
			? `${Number(l.lineTotalDelta) > 0 ? '+' : ''}${fmtUsd(Number(l.lineTotalDelta))}`
			: '',
		l.reasonText ?? ''
	]);

	const netChange = Number(data.netAmountChange ?? 0);
	const toLines = [
		data.repFirm ?? '(no rep firm assigned)',
		data.repFirmOrderEmails ?? null
	];
	const fromLines = [
		ILC_OFFICE_DEFAULT.name,
		ILC_OFFICE_DEFAULT.address,
		ILC_OFFICE_DEFAULT.cityStateZip,
		data.pmEmail ?? ILC_OFFICE_DEFAULT.email
	];

	return (
		<Document
			title={`${data.coNo} — ILC Studios Change Order against ${data.poNo}`}
			author="ILC Studios"
			subject={`Change Order ${data.coNo}`}
		>
			<Page size="LETTER" style={styles.page}>
				<DocHeader
					title="Change Order"
					docNo={data.coNo}
					dateLabel="Date"
					dateValue={fmtDate(data.sentAt ?? data.createdAt)}
				/>

				<ToFromBlock
					to={{ label: 'To', lines: toLines }}
					from={{ label: 'From', lines: fromLines }}
				/>

				<MetaStrip
					items={[
						{ label: 'CO #', value: data.coNo },
						{ label: 'PO #', value: data.poNo },
						{ label: 'Project', value: data.projectName },
						{
							label: 'Versions',
							value: data.versionNoAfter
								? `v${data.versionNoBefore} → v${data.versionNoAfter}`
								: `against v${data.versionNoBefore}`
						},
						{ label: 'Status', value: data.status.toUpperCase() },
						{ label: 'Sent', value: fmtDate(data.sentAt) || undefined },
						{ label: 'Applied', value: fmtDate(data.appliedAt) || undefined }
					]}
				/>

				<CustomMessage message={data.customEmailMessage} />

				{data.description && (
					<View
						style={{
							marginBottom: 12,
							padding: 8,
							backgroundColor: '#fafafa',
							borderLeftWidth: 3,
							borderLeftColor: '#999'
						}}
					>
						<Text style={[styles.bodyText, { fontWeight: 'bold' }]}>Reason for this change:</Text>
						<Text style={styles.bodyText}>{data.description}</Text>
					</View>
				)}

				<Text style={styles.h2}>Changes</Text>
				<LinesTable columns={COLUMNS} rows={rows} />

				<View style={{ marginTop: 16, alignItems: 'flex-end' }}>
					<View
						style={{
							padding: 10,
							backgroundColor: netChange > 0 ? '#fdf0f0' : netChange < 0 ? '#f0fbf3' : '#fafafa',
							borderRadius: 4,
							minWidth: 240
						}}
					>
						<Text style={{ fontSize: 9, color: '#666', textTransform: 'uppercase' }}>
							Net change to PO total
						</Text>
						<Text
							style={{
								fontSize: 18,
								fontWeight: 'bold',
								color: netChange > 0 ? '#7a1212' : netChange < 0 ? '#0a7c2f' : '#111',
								marginTop: 2
							}}
						>
							{netChange > 0 ? '+' : ''}
							{fmtUsd(netChange)}
						</Text>
					</View>
				</View>

				<View style={{ marginTop: 16, padding: 8, backgroundColor: '#fafafa' }}>
					<Text style={styles.bodyText}>
						Please acknowledge receipt and confirm any pricing impacts. Reference {data.coNo}{' '}
						against PO {data.poNo} in your reply.
					</Text>
				</View>

				<Footer
					left={[
						ILC_OFFICE_DEFAULT.name,
						ILC_OFFICE_DEFAULT.address + ' · ' + ILC_OFFICE_DEFAULT.cityStateZip,
						ILC_OFFICE_DEFAULT.email
					]}
					right={[`CO ${data.coNo} against PO ${data.poNo}`, `Generated ${fmtDate(new Date())}`]}
				/>
			</Page>
		</Document>
	);
}
