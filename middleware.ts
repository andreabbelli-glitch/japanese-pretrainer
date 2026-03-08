import type { NextRequest } from 'next/server';
import { updateSession } from '@/src/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/dashboard/:path*', '/goals/:path*', '/review/:path*', '/settings/:path*'],
};
