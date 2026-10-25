import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sameOrigin } from "@/lib/http";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());

function request(origin = "http://127.0.0.1:3000", host = "127.0.0.1:3000") {
  return new NextRequest("http://127.0.0.1:3000/api/pay", {
    method: "POST",
    headers: {
      origin,
      host,
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
    },
  });
}

it("accepts the pinned browser origin despite Next.js loopback normalization", () => {
  vi.stubEnv("AIDFLOW_PUBLIC_ORIGIN", "http://127.0.0.1:3000");
  const r = request();
  expect(new URL(r.url).hostname).toBe("localhost");
  expect(() => sameOrigin(r)).not.toThrow();
});

it("rejects forged Host, alternate origins, absent Origin and cross-site mutations", () => {
  vi.stubEnv("AIDFLOW_PUBLIC_ORIGIN", "http://127.0.0.1:3000");
  expect(() =>
    sameOrigin(request("http://127.0.0.1:3000", "evil.example")),
  ).toThrow();
  expect(() => sameOrigin(request("https://evil.example"))).toThrow();
  expect(() => sameOrigin(request("http://localhost:3000"))).toThrow();
  const absent = request();
  absent.headers.delete("origin");
  expect(() => sameOrigin(absent)).toThrow();
  const crossSite = request();
  crossSite.headers.set("sec-fetch-site", "cross-site");
  expect(() => sameOrigin(crossSite)).toThrow();
});

it("pins a public HTTPS origin and ignores attacker-supplied forwarded headers", () => {
  vi.stubEnv("AIDFLOW_PUBLIC_ORIGIN", "https://aidflow.example");
  expect(() =>
    sameOrigin(request("https://aidflow.example", "aidflow.example")),
  ).not.toThrow();
  const forged = request("https://evil.example", "evil.example");
  forged.headers.set("x-forwarded-host", "aidflow.example");
  forged.headers.set("x-forwarded-proto", "https");
  expect(() => sameOrigin(forged)).toThrow();
});

it.each([
  "https://user:password@aidflow.example",
  "https://aidflow.example/path",
  "https://aidflow.example?query=1",
  "https://aidflow.example/#fragment",
  "http://public.example",
  "null",
  "not-a-url",
])("fails closed for invalid canonical origin %s", (value) => {
  vi.stubEnv("AIDFLOW_PUBLIC_ORIGIN", value);
  // This origin matches the normalized request URL: rejection must come from
  // invalid server configuration, not the existing origin mismatch guard.
  expect(() =>
    sameOrigin(request("http://localhost:3000", "localhost:3000")),
  ).toThrow();
});

it("preserves the original origin check when no canonical origin is configured", () => {
  vi.stubEnv("AIDFLOW_PUBLIC_ORIGIN", "");
  expect(() =>
    sameOrigin(
      new Request("https://starter.example/api/pay", {
        headers: {
          origin: "https://starter.example",
          "content-type": "application/json",
        },
      }),
    ),
  ).not.toThrow();
  expect(() => sameOrigin(request())).toThrow();
});
