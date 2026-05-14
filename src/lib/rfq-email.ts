import 'server-only';

export type RfqEmailLine = {
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	qty: string | null;
	description: string | null;
};

export type RfqEmailContext = {
	rfqNo: string;
	projectName: string;
	repFirmName: string;
	pmName: string | null;
	pmEmail: string;
	notes: string | null;
	lines: RfqEmailLine[];
	appUrl: string; // base URL for "view RFQ" link, e.g. https://main.dxxx.amplifyapp.com
	rfqUrl: string; // direct URL to this RFQ on Ebisu
};

/**
 * Render the HTML body for an RFQ email. Plain inline CSS for compatibility
 * with rep firms' email clients (Outlook, Gmail, Apple Mail). No external
 * dependencies, no images — just a clean table.
 */
export function renderRfqEmailHtml(ctx: RfqEmailContext): string {
	const rows = ctx.lines
		.map((l, i) => {
			const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
			return `
<tr style="background:${bg};">
  <td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;">${escape(l.type ?? '')}</td>
  <td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;font-weight:600;">${escape(l.catalogNo ?? '')}</td>
  <td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;">${escape(l.manufacturer ?? '')}</td>
  <td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;text-align:right;">${escape(l.qty ?? '')}</td>
  <td style="padding:6px 10px;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px;color:#555;">${escape(l.description ?? '')}</td>
</tr>`;
		})
		.join('');

	const notesBlock = ctx.notes
		? `
<p style="font-family:Arial,sans-serif;font-size:14px;color:#333;margin:16px 0;">
  <strong>Notes from ${escape(ctx.pmName ?? ctx.pmEmail)}:</strong><br>
  ${escape(ctx.notes).replace(/\n/g, '<br>')}
</p>`
		: '';

	return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#222;">
  <table style="max-width:800px;margin:0 auto;background:#fff;padding:24px;border-radius:4px;border:1px solid #ddd;">
    <tr><td>
      <h2 style="margin:0 0 4px 0;color:#111;">Request for Quote — ${escape(ctx.rfqNo)}</h2>
      <p style="margin:0;color:#666;font-size:14px;">Project: <strong>${escape(ctx.projectName)}</strong></p>
      <p style="margin:4px 0 16px 0;color:#666;font-size:14px;">To: <strong>${escape(ctx.repFirmName)}</strong></p>

      <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
        Hello,
      </p>
      <p style="font-family:Arial,sans-serif;font-size:14px;color:#333;">
        Please provide dealer-net pricing on the lines below for project <strong>${escape(ctx.projectName)}</strong>.
        Reply to this email with your quote, or to <a href="mailto:${escape(ctx.pmEmail)}">${escape(ctx.pmEmail)}</a>.
      </p>

      ${notesBlock}

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#222;color:#fff;">
            <th style="padding:8px 10px;text-align:left;font-family:Arial,sans-serif;font-size:12px;border:1px solid #222;">TYPE</th>
            <th style="padding:8px 10px;text-align:left;font-family:Arial,sans-serif;font-size:12px;border:1px solid #222;">CATALOG #</th>
            <th style="padding:8px 10px;text-align:left;font-family:Arial,sans-serif;font-size:12px;border:1px solid #222;">MANUFACTURER</th>
            <th style="padding:8px 10px;text-align:right;font-family:Arial,sans-serif;font-size:12px;border:1px solid #222;">QTY</th>
            <th style="padding:8px 10px;text-align:left;font-family:Arial,sans-serif;font-size:12px;border:1px solid #222;">DESCRIPTION</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin-top:24px;">
        Thank you,<br>
        ${escape(ctx.pmName ?? '')} ${ctx.pmName ? '·' : ''} <a href="mailto:${escape(ctx.pmEmail)}">${escape(ctx.pmEmail)}</a><br>
        ILC Studios
      </p>

      <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#999;">
        This RFQ was sent from Ebisu — ILC Studios' procurement system.
        <a href="${escape(ctx.rfqUrl)}" style="color:#1a4ed8;">View RFQ in Ebisu</a>
        (Sean / Mason / Olivia only).
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderRfqEmailText(ctx: RfqEmailContext): string {
	const rows = ctx.lines
		.map(
			(l) =>
				`  - TYPE ${l.type ?? ''} | CATALOG # ${l.catalogNo ?? ''} | ${l.manufacturer ?? ''} | QTY ${l.qty ?? ''} | ${l.description ?? ''}`
		)
		.join('\n');

	return `Request for Quote — ${ctx.rfqNo}
Project: ${ctx.projectName}
To: ${ctx.repFirmName}

Hello,

Please provide dealer-net pricing on the lines below for project ${ctx.projectName}.
Reply to this email with your quote, or to ${ctx.pmEmail}.

${ctx.notes ? `Notes from ${ctx.pmName ?? ctx.pmEmail}:\n${ctx.notes}\n\n` : ''}Lines:
${rows}

Thank you,
${ctx.pmName ?? ''}
${ctx.pmEmail}
ILC Studios

— Sent from Ebisu (${ctx.rfqUrl})`;
}

function escape(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
