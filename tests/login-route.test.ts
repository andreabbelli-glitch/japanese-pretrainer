import { describe, expect, it, vi } from "vitest";

const { getAuthConfigMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn()
}));

vi.mock("@/components/auth/login-page-content", () => ({
  LoginPageContent: (props: unknown) => ({ props, type: "mock-login-page" })
}));

vi.mock("@/lib/auth", () => ({
  getAuthConfig: getAuthConfigMock
}));

import LoginRoute from "@/app/login/page";

describe("login route", () => {
  it("treats duplicated search params as valid when any candidate matches", async () => {
    getAuthConfigMock.mockReturnValue({
      enabled: true
    });

    const element = await LoginRoute({
      searchParams: Promise.resolve({
        error: ["oops", "credentials"],
        loggedOut: ["0", "1"],
        next: ["", "/review?answered=3&card=card-iku"]
      })
    });

    expect(element.props).toMatchObject({
      nextHref: "/review?answered=3&card=card-iku",
      showCredentialsError: true,
      showLoggedOutNotice: true
    });
  });
});
