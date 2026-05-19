import './globals.css';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/dal';
import SignOutButton from '@/components/SignOutButton';

export const metadata: Metadata = {
	title: 'Ebisu',
	description: 'ILC Studios procurement workspace.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const user = await getCurrentUser();
	return (
		<html lang="en">
			<body>
				<nav className="app-nav">
					<strong>Ebisu</strong>
					<a href="/">Home</a>
					<span className="nav-sep">|</span>
					<a href="/projects">Projects</a>
					<a href="/rfqs">RFQs</a>
					<a href="/sos">SOs</a>
					<a href="/pos">POs</a>
					<a href="/shipments">Shipments</a>
					<a href="/invoices">Invoices</a>
					<a href="/bills">Bills</a>
					<span className="nav-sep">|</span>
					<a href="/companies">Companies</a>
					<a href="/qbo">QBO</a>
					<a href="/help">Help</a>
					<span className="spacer" />
					{user ? (
						<>
							<span className="user">
								{user.email} · {user.role}
							</span>
							<SignOutButton />
						</>
					) : (
						<a href="/signin">Sign in</a>
					)}
				</nav>
				<main className="app-main">{children}</main>
			</body>
		</html>
	);
}
