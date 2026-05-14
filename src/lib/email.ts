import 'server-only';
import { Resend } from 'resend';

let _resend: Resend | null = null;

function client(): Resend | null {
	if (!process.env.RESEND_API_KEY) return null;
	if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
	return _resend;
}

export type SendEmailArgs = {
	to: string[];
	cc?: string[];
	replyTo?: string;
	subject: string;
	html: string;
	text?: string;
};

export type SendEmailResult = {
	ok: boolean;
	id?: string;
	redirectedTo?: string[];
	error?: string;
};

/**
 * Send a transactional email via Resend. Honors DEV_EMAIL_REDIRECT: if set,
 * ALL emails go to that address regardless of the original recipients —
 * useful during testing so we don't email real reps. The original recipients
 * are noted in the subject line so PMs can verify.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
	const r = client();
	if (!r) {
		return {
			ok: false,
			error:
				'RESEND_API_KEY is not set. Add it as an Amplify env var (and bake it into .env.production via amplify.yml) to enable email send.'
		};
	}

	const from = process.env.EMAIL_FROM ?? 'Ebisu <ebisu@ilcstudios.com>';
	const redirect = process.env.DEV_EMAIL_REDIRECT;

	const realTo = args.to;
	const realCc = args.cc;

	const to = redirect ? [redirect] : realTo;
	const cc = redirect ? undefined : realCc;
	const subject = redirect
		? `[DEV redirect — orig to: ${realTo.join(', ')}] ${args.subject}`
		: args.subject;

	try {
		const result = await r.emails.send({
			from,
			to,
			cc,
			replyTo: args.replyTo,
			subject,
			html: args.html,
			text: args.text
		});
		if (result.error) {
			return { ok: false, error: result.error.message };
		}
		return {
			ok: true,
			id: result.data?.id,
			redirectedTo: redirect ? [redirect] : undefined
		};
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}
