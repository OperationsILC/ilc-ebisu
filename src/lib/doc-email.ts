import 'server-only';

/**
 * Shared email template for SO/PO/Invoice/Change Order/Budget sends. The PDF
 * carries the branded layout; the email body is a clean handoff with a small
 * line table for "skim in inbox" preview. Inline CSS only — rep firms and
 * clients use a mix of Outlook / Gmail / Apple Mail and external CSS doesn't
 * survive the trip.
 */

export type DocEmailLine = {
	c1: string | null; // type or catalog #
	c2: string | null; // catalog # or description
	c3: string | null; // manufacturer
	c4: string | null; // description (or right-aligned qty for some docs)
	c5: string | null; // right-aligned numeric
	c6?: string | null;
};

export type DocEmailContext = {
	docKindLabel: string; // "Purchase Order", "Sales Order", "Invoice", "Change Order", "Budget"
	docNo: string;
	projectName: string;
	recipientName: string | null; // company name on the To side
	pmName: string | null;
	pmEmail: string;
	customMessage: string | null;
	columns: string[]; // headers for the line table (5-6 cols)
	lines: DocEmailLine[];
	totalsLines?: { label: string; value: string }[];
	grandLabel?: string;
	grandValue?: string;
	appUrl: string;
	docUrl: string;
	closing?: string; // e.g. "Please confirm receipt." / "Payment due 2026-06-14."
};

function esc(s: string | null | undefined): string {
	if (!s) return '';
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

export function renderDocEmailHtml(ctx: DocEmailContext): string {
	const colHtml = ctx.columns
		.map(
			(c, i) => `<th style="padding:6px 10px;border:1px solid #ddd;background:#f4f4f4;font-family:Arial,sans-serif;font-size:12px;text-align:${i >= 4 ? 'right' : 'left'};">${esc(c)}</th>`
		)
		.join('');

	const rowsHtml = ctx.lines
		.map((l, i) => {
			const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
			const cells = [l.c1, l.c2, l.c3, l.c4, l.c5, l.c6].slice(0, ctx.columns.length);
			return `<tr style="background:${bg};">${cells
				.map(
					(v, idx) =>
						`<td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;${idx >= 4 ? 'text-align:right;' : ''}${idx === 3 ? 'color:#555;' : ''}">${esc(v ?? '')}</td>`
				)
				.join('')}</tr>`;
		})
		.join('');

	const totalsHtml = (ctx.totalsLines ?? [])
		.map(
			(t) =>
				`<tr><td style="padding:4px 10px;font-family:Arial,sans-serif;font-size:13px;text-align:right;color:#555;">${esc(t.label)}</td><td style="padding:4px 10px;font-family:Arial,sans-serif;font-size:13px;text-align:right;font-weight:600;">${esc(t.value)}</td></tr>`
		)
		.join('');

	const grandHtml =
		ctx.grandLabel && ctx.grandValue
			? `<tr><td style="padding:8px 10px;border-top:2px solid #111;font-family:Arial,sans-serif;font-size:14px;text-align:right;font-weight:bold;">${esc(ctx.grandLabel)}</td><td style="padding:8px 10px;border-top:2px solid #111;font-family:Arial,sans-serif;font-size:14px;text-align:right;font-weight:bold;color:#F58220;">${esc(ctx.grandValue)}</td></tr>`
			: '';

	const customBlock = ctx.customMessage
		? `<table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-left:3px solid #F58220;background:#fafafa;"><tr><td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:14px;color:#333;white-space:pre-wrap;">${esc(ctx.customMessage)}</td></tr></table>`
		: '';

	const closingBlock = ctx.closing
		? `<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:16px 0;">${esc(ctx.closing)}</p>`
		: '';

	return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f7f7;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f7f7f7;">
<tr><td style="padding:24px 16px;">
<table cellpadding="0" cellspacing="0" border="0" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #ddd;">
<tr><td style="padding:20px 24px;border-bottom:3px solid #F58220;">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
<tr>
<td style="font-family:Arial,sans-serif;font-size:24px;color:#111;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">${esc(ctx.docKindLabel)}</td>
<td style="font-family:Arial,sans-serif;font-size:18px;color:#F58220;font-weight:bold;text-align:right;">${esc(ctx.docNo)}</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:16px 24px;">
<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:0 0 8px 0;">
${ctx.recipientName ? `<strong>To:</strong> ${esc(ctx.recipientName)}<br/>` : ''}
<strong>Project:</strong> ${esc(ctx.projectName)}<br/>
${ctx.pmName ? `<strong>From:</strong> ${esc(ctx.pmName)} (${esc(ctx.pmEmail)})` : `<strong>From:</strong> ${esc(ctx.pmEmail)}`}
</p>

${customBlock}

<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:8px 0;">
<thead><tr>${colHtml}</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>

${totalsHtml || grandHtml ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0 auto;min-width:280px;">${totalsHtml}${grandHtml}</table>` : ''}

${closingBlock}

<p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin:16px 0 0 0;">
A branded PDF of this ${esc(ctx.docKindLabel.toLowerCase())} is attached. The full document and any revisions live at
<a href="${esc(ctx.docUrl)}" style="color:#F58220;">${esc(ctx.docUrl)}</a> (ILC Studios staff only).
</p>
</td></tr>

<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #ddd;font-family:Arial,sans-serif;font-size:11px;color:#666;">
ILC Studios · 2301 Blake Street, Ste. 100, Denver, CO 80205 · ilcstudios.com
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderDocEmailText(ctx: DocEmailContext): string {
	const lines: string[] = [
		`${ctx.docKindLabel.toUpperCase()} ${ctx.docNo}`,
		ctx.recipientName ? `To: ${ctx.recipientName}` : '',
		`Project: ${ctx.projectName}`,
		ctx.pmName
			? `From: ${ctx.pmName} (${ctx.pmEmail})`
			: `From: ${ctx.pmEmail}`,
		''
	];
	if (ctx.customMessage) {
		lines.push(ctx.customMessage, '');
	}
	const headerLine = ctx.columns.join(' | ');
	lines.push(headerLine, '-'.repeat(headerLine.length));
	for (const l of ctx.lines) {
		const cells = [l.c1, l.c2, l.c3, l.c4, l.c5, l.c6]
			.slice(0, ctx.columns.length)
			.map((v) => v ?? '');
		lines.push(cells.join(' | '));
	}
	if (ctx.totalsLines?.length) {
		lines.push('');
		for (const t of ctx.totalsLines) lines.push(`${t.label}: ${t.value}`);
	}
	if (ctx.grandLabel && ctx.grandValue) {
		lines.push(`${ctx.grandLabel}: ${ctx.grandValue}`);
	}
	if (ctx.closing) lines.push('', ctx.closing);
	lines.push(
		'',
		`A branded PDF is attached. Internal link: ${ctx.docUrl}`,
		'',
		'ILC Studios · 2301 Blake Street, Ste. 100, Denver, CO 80205'
	);
	return lines.filter((x) => x !== undefined).join('\n');
}

/**
 * Parse a comma/semicolon/whitespace-separated list of emails and filter to
 * the ones that look syntactically valid. Used by every Send action.
 */
export function parseEmails(input: string | null | undefined): string[] {
	if (!input) return [];
	return input
		.split(/[,;\s]+/)
		.map((s) => s.trim())
		.filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}
