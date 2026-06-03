import { describe, expect, it } from "vitest";

import nextConfig from "../next.config.ts";

describe("next config", () => {
  it("serves generated media audio with immutable browser and CDN cache headers", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toEqual(
      expect.arrayContaining([
        {
          source: "/media-audio/:path*",
          headers: expect.arrayContaining([
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable"
            },
            {
              key: "X-Content-Type-Options",
              value: "nosniff"
            }
          ])
        }
      ])
    );
  });
});
