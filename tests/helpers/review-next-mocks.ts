import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePathMock: vi.fn()
}));

export const revalidatePathMock = mocks.revalidatePathMock;

vi.mock("next/navigation", () => ({
  usePathname: () => "/media/test/review",
  useRouter: () => ({
    replace: () => undefined
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));
