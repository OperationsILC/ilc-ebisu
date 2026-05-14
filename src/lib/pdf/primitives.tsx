/* eslint-disable jsx-a11y/alt-text */
// @react-pdf has its own JSX namespace (Page/Text/View/etc.) — these aren't
// DOM elements, so a11y lint rules don't apply.

import { StyleSheet, Text, View, Image } from '@react-pdf/renderer';
import { ILC_ORANGE, ILC_BLACK, MUTED, RULE, STRIPE, FS } from './theme';
import path from 'node:path';

// File-system path to the wordmark logo. @react-pdf reads bytes at render time
// from a local path or buffer; we ship the file in /public/brand.
export const WORDMARK_PATH = path.join(process.cwd(), 'public', 'brand', 'ilc-wordmark.png');
export const MARK_PATH = path.join(process.cwd(), 'public', 'brand', 'ilc-mark.png');

export const styles = StyleSheet.create({
	page: {
		paddingTop: 36,
		paddingBottom: 56,
		paddingLeft: 36,
		paddingRight: 36,
		fontSize: FS.body,
		color: ILC_BLACK,
		fontFamily: 'Helvetica'
	},
	headerRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 18
	},
	wordmark: {
		width: 160,
		height: 'auto'
	},
	docTitleBox: {
		alignItems: 'flex-end'
	},
	docTitle: {
		fontSize: FS.doc,
		fontWeight: 'bold',
		color: ILC_BLACK,
		letterSpacing: 1,
		textTransform: 'uppercase'
	},
	docNo: {
		fontSize: FS.h2,
		color: ILC_ORANGE,
		fontWeight: 'bold',
		marginTop: 2
	},
	docMeta: {
		fontSize: FS.small,
		color: MUTED,
		marginTop: 2
	},

	hr: {
		borderBottomWidth: 1,
		borderBottomColor: ILC_ORANGE,
		marginBottom: 10
	},

	twoCol: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 24,
		marginBottom: 14
	},
	colHalf: {
		flexBasis: '48%',
		flexGrow: 0,
		flexShrink: 1
	},
	colLabel: {
		fontSize: FS.tiny,
		color: MUTED,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 3
	},
	colBlock: {
		fontSize: FS.body,
		color: ILC_BLACK,
		lineHeight: 1.4
	},

	stripRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
		paddingVertical: 8,
		borderTopWidth: 0.5,
		borderTopColor: RULE,
		borderBottomWidth: 0.5,
		borderBottomColor: RULE,
		marginBottom: 14
	},
	stripItem: {
		minWidth: 80
	},
	stripLabel: {
		fontSize: FS.tiny,
		color: MUTED,
		textTransform: 'uppercase',
		letterSpacing: 0.4
	},
	stripValue: {
		fontSize: FS.body,
		color: ILC_BLACK,
		fontWeight: 'bold'
	},

	customMessage: {
		marginBottom: 14,
		padding: 8,
		backgroundColor: STRIPE,
		borderLeftWidth: 3,
		borderLeftColor: ILC_ORANGE,
		fontSize: FS.body,
		lineHeight: 1.4
	},

	table: {
		marginTop: 4,
		marginBottom: 12,
		borderTopWidth: 0.5,
		borderTopColor: RULE
	},
	thRow: {
		flexDirection: 'row',
		backgroundColor: ILC_BLACK,
		paddingVertical: 5,
		paddingHorizontal: 4
	},
	th: {
		color: '#ffffff',
		fontSize: FS.tiny,
		fontWeight: 'bold',
		textTransform: 'uppercase',
		letterSpacing: 0.3
	},
	tdRow: {
		flexDirection: 'row',
		paddingVertical: 4,
		paddingHorizontal: 4,
		borderBottomWidth: 0.5,
		borderBottomColor: RULE,
		alignItems: 'flex-start'
	},
	tdRowAlt: {
		flexDirection: 'row',
		paddingVertical: 4,
		paddingHorizontal: 4,
		borderBottomWidth: 0.5,
		borderBottomColor: RULE,
		alignItems: 'flex-start',
		backgroundColor: STRIPE
	},
	td: {
		fontSize: FS.small,
		color: ILC_BLACK
	},
	tdMuted: {
		fontSize: FS.small,
		color: MUTED
	},
	tdRight: {
		fontSize: FS.small,
		color: ILC_BLACK,
		textAlign: 'right'
	},

	totalsBox: {
		alignSelf: 'flex-end',
		width: 240,
		marginTop: 6,
		marginBottom: 18
	},
	totalsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 3
	},
	totalsLabel: {
		fontSize: FS.body,
		color: ILC_BLACK
	},
	totalsValue: {
		fontSize: FS.body,
		color: ILC_BLACK,
		fontWeight: 'bold'
	},
	totalsGrand: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingTop: 6,
		marginTop: 4,
		borderTopWidth: 1,
		borderTopColor: ILC_BLACK
	},
	totalsGrandLabel: {
		fontSize: FS.h2,
		color: ILC_BLACK,
		fontWeight: 'bold'
	},
	totalsGrandValue: {
		fontSize: FS.h2,
		color: ILC_ORANGE,
		fontWeight: 'bold'
	},

	footer: {
		position: 'absolute',
		bottom: 28,
		left: 36,
		right: 36,
		flexDirection: 'row',
		justifyContent: 'space-between',
		fontSize: FS.tiny,
		color: MUTED,
		borderTopWidth: 0.5,
		borderTopColor: RULE,
		paddingTop: 6
	},
	footerLeft: {
		flexDirection: 'column',
		gap: 1
	},
	footerRight: {
		alignItems: 'flex-end'
	},

	h2: {
		fontSize: FS.h2,
		fontWeight: 'bold',
		marginTop: 6,
		marginBottom: 4,
		color: ILC_BLACK
	},
	bodyText: {
		fontSize: FS.body,
		color: ILC_BLACK,
		lineHeight: 1.4
	},
	muted: {
		color: MUTED
	}
});

// ---------------------------------------------------------------------------
// Reusable building blocks
// ---------------------------------------------------------------------------

export function DocHeader({
	title,
	docNo,
	dateLabel,
	dateValue
}: {
	title: string;
	docNo: string;
	dateLabel?: string;
	dateValue?: string;
}) {
	return (
		<>
			<View style={styles.headerRow}>
				<Image src={WORDMARK_PATH} style={styles.wordmark} />
				<View style={styles.docTitleBox}>
					<Text style={styles.docTitle}>{title}</Text>
					<Text style={styles.docNo}>{docNo}</Text>
					{dateLabel && dateValue && (
						<Text style={styles.docMeta}>
							{dateLabel}: {dateValue}
						</Text>
					)}
				</View>
			</View>
			<View style={styles.hr} />
		</>
	);
}

export function ToFromBlock({
	to,
	from
}: {
	to: { label: string; lines: (string | null | undefined)[] };
	from: { label: string; lines: (string | null | undefined)[] };
}) {
	return (
		<View style={styles.twoCol}>
			<View style={styles.colHalf}>
				<Text style={styles.colLabel}>{to.label}</Text>
				<View style={styles.colBlock}>
					{to.lines.filter(Boolean).map((l, i) => (
						<Text key={i}>{l}</Text>
					))}
				</View>
			</View>
			<View style={styles.colHalf}>
				<Text style={styles.colLabel}>{from.label}</Text>
				<View style={styles.colBlock}>
					{from.lines.filter(Boolean).map((l, i) => (
						<Text key={i}>{l}</Text>
					))}
				</View>
			</View>
		</View>
	);
}

export function MetaStrip({ items }: { items: { label: string; value: string | null | undefined }[] }) {
	const visible = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '');
	if (visible.length === 0) return null;
	return (
		<View style={styles.stripRow}>
			{visible.map((it, i) => (
				<View key={i} style={styles.stripItem}>
					<Text style={styles.stripLabel}>{it.label}</Text>
					<Text style={styles.stripValue}>{it.value}</Text>
				</View>
			))}
		</View>
	);
}

export function CustomMessage({ message }: { message: string | null | undefined }) {
	if (!message || !message.trim()) return null;
	return (
		<View style={styles.customMessage}>
			<Text>{message}</Text>
		</View>
	);
}

// Lines table — columns parametrised. Each cell value is already string-formatted.
export type LineCol = {
	header: string;
	width: number; // % of table width
	align?: 'left' | 'right';
	muted?: boolean;
};

export function LinesTable({
	columns,
	rows
}: {
	columns: LineCol[];
	rows: string[][];
}) {
	return (
		<View style={styles.table}>
			<View style={styles.thRow}>
				{columns.map((c, i) => (
					<Text
						key={i}
						style={[
							styles.th,
							{ width: `${c.width}%`, textAlign: c.align ?? 'left' }
						]}
					>
						{c.header}
					</Text>
				))}
			</View>
			{rows.map((row, ri) => (
				<View key={ri} style={ri % 2 === 0 ? styles.tdRow : styles.tdRowAlt}>
					{columns.map((c, ci) => (
						<Text
							key={ci}
							style={[
								c.muted ? styles.tdMuted : styles.td,
								{ width: `${c.width}%`, textAlign: c.align ?? 'left' }
							]}
						>
							{row[ci] ?? ''}
						</Text>
					))}
				</View>
			))}
		</View>
	);
}

export function TotalsBox({
	rows,
	grand
}: {
	rows: { label: string; value: string }[];
	grand: { label: string; value: string };
}) {
	return (
		<View style={styles.totalsBox}>
			{rows.map((r, i) => (
				<View key={i} style={styles.totalsRow}>
					<Text style={styles.totalsLabel}>{r.label}</Text>
					<Text style={styles.totalsValue}>{r.value}</Text>
				</View>
			))}
			<View style={styles.totalsGrand}>
				<Text style={styles.totalsGrandLabel}>{grand.label}</Text>
				<Text style={styles.totalsGrandValue}>{grand.value}</Text>
			</View>
		</View>
	);
}

export function Footer({
	left,
	right,
	pageOf = true
}: {
	left: string[];
	right?: string[];
	pageOf?: boolean;
}) {
	return (
		<View style={styles.footer} fixed>
			<View style={styles.footerLeft}>
				{left.map((l, i) => (
					<Text key={i}>{l}</Text>
				))}
			</View>
			<View style={styles.footerRight}>
				{(right ?? []).map((l, i) => (
					<Text key={i}>{l}</Text>
				))}
				{pageOf && (
					<Text
						render={({ pageNumber, totalPages }) => `page ${pageNumber} of ${totalPages}`}
					/>
				)}
			</View>
		</View>
	);
}

// Helper: format numeric strings consistently
export function fmtUsd(n: number, fractionDigits = 2): string {
	return n.toLocaleString('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	});
}

export function fmtNum(n: number, fractionDigits = 0): string {
	return n.toLocaleString('en-US', {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits
	});
}

export function fmtDate(iso: string | Date | null | undefined): string {
	if (!iso) return '';
	const d = typeof iso === 'string' ? new Date(iso) : iso;
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
