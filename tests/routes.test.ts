import { describe, expect, it } from "vitest";
import { isProtectedPath, protectedRouteMatchers, protectedRoutePrefixes } from "../src/lib/routes";

describe("route protection helpers", () => {
  it("keeps the protected route list aligned with the middleware matcher", () => {
    expect(protectedRouteMatchers).toEqual(
      protectedRoutePrefixes.map((route) => `${route}/:path*`),
    );
  });

  it("recognizes protected paths and nested protected paths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/progresso")).toBe(true);
    expect(isProtectedPath("/review/session")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
  });

  it("does not mark public paths as protected", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/lessons")).toBe(false);
  });
});
