import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require auth.
const PUBLIC_PATHS = new Set(['/signin']);

export async function proxy(req: NextRequest) {
	const path = req.nextUrl.pathname;

	// Always allow auth API routes (signin callbacks, etc.).
	if (path.startsWith('/api/auth')) return NextResponse.next();
	if (PUBLIC_PATHS.has(path)) return NextResponse.next();

	// Dev-mode short-circuit: never engages in production.
	if (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS_EMAIL) {
		return NextResponse.next();
	}

	const session = await auth();
	if (!session?.user) {
		const url = new URL('/signin', req.url);
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)']
};
