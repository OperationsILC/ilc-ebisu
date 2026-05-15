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
					<a href="/projects">Projects</a>
					<a href="/companies">Companies</a>
					<a href="/bills">Bills inbox</a>
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
