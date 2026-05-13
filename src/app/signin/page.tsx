import { signIn } from '@/auth';

export default function SignInPage() {
	return (
		<div
			style={{
				maxWidth: '420px',
				margin: '80px auto',
				padding: '24px',
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<h1 style={{ marginTop: 0 }}>Sign in to Ebisu</h1>
			<p className="muted">ILC Studios procurement workspace.</p>

			<p>
				Sign in with your <strong>@ilcstudios.com</strong> Google account.
			</p>

			<form
				action={async () => {
					'use server';
					await signIn('google', { redirectTo: '/' });
				}}
			>
				<button className="primary" style={{ width: '100%', padding: '10px' }} type="submit">
					Sign in with Google
				</button>
			</form>

			<p className="muted" style={{ marginTop: '24px', fontSize: '11px' }}>
				Access is restricted to ILC Studios employees. If your Google account is on a different
				domain you&apos;ll be turned away. Talk to Sean or an admin if that&apos;s wrong.
			</p>
		</div>
	);
}
