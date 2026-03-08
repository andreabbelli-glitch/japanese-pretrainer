export const protectedRoutePrefixes = ['/dashboard', '/goals', '/review', '/settings'] as const;

export const protectedRouteMatchers = protectedRoutePrefixes.map((route) => `${route}/:path*`);

export function isProtectedPath(pathname: string) {
  return protectedRoutePrefixes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
