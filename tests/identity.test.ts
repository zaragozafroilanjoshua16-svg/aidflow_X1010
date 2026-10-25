import { expect, it } from "vitest";
import {
  allowGoogleProfile,
  safeRedirect,
  requireActor,
} from "@/lib/identity-policy";
it("requires a verified Google profile and never accepts a client role", () => {
  expect(
    allowGoogleProfile("google", {
      email: "demo@example.invalid",
      email_verified: true,
    }),
  ).toBe(true);
  expect(
    allowGoogleProfile("google", {
      email: "demo@example.invalid",
      email_verified: false,
      role: "ADMIN",
    }),
  ).toBe(false);
  expect(
    allowGoogleProfile("credentials", {
      email: "demo@example.invalid",
      email_verified: true,
    }),
  ).toBe(false);
});
it("limits callback redirects to the pinned origin", () => {
  expect(safeRedirect("https://evil.example", "https://aidflow.example")).toBe(
    "https://aidflow.example/",
  );
  expect(safeRedirect("/dashboard", "https://aidflow.example")).toBe(
    "https://aidflow.example/dashboard",
  );
  expect(safeRedirect("//evil.example", "https://aidflow.example")).toBe(
    "https://aidflow.example/",
  );
});
it("rejects missing sessions and USER admin access", () => {
  expect(() => requireActor(null)).toThrow();
  expect(() => requireActor({ id: "user", role: "USER" }, true)).toThrow();
  expect(requireActor({ id: "admin", role: "ADMIN" }, true).id).toBe("admin");
});
