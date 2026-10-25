import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/pay/route";
import { AccessError } from "@/lib/identity-policy";
vi.mock("server-only", () => ({}));
const calls = vi.hoisted(() => ({ auth: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/identity", () => ({ requireUser: calls.auth }));
vi.mock("@/lib/paiflow", () => ({
  preparePayment: calls.prepare,
  submitPayment: vi.fn(),
  paymentStatus: vi.fn(),
}));
vi.mock("@/lib/orders", () => ({
  prepareOrder: calls.prepare,
  submitOrder: vi.fn(),
  reconcileOrder: vi.fn(),
}));
vi.mock("@/lib/app-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/app-api")>()),
  userBudget: vi.fn(),
}));
function request(body: unknown) {
  return new Request("https://aidflow.example/api/pay", {
    method: "POST",
    headers: {
      origin: "https://aidflow.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
it("requires a server session before any preparation and rejects raw wallet pricing requests", async () => {
  calls.auth.mockRejectedValue(new AccessError(401));
  calls.prepare.mockResolvedValue({ prepared: true });
  expect(
    (await POST(request({ action: "prepare", from: "public-wallet" }))).status,
  ).toBe(401);
  expect(calls.prepare).not.toHaveBeenCalled();
  calls.auth.mockResolvedValue({ id: "signed-in", role: "USER" });
  expect(
    (await POST(request({ action: "prepare", from: "public-wallet" }))).status,
  ).toBe(400);
  expect(calls.prepare).not.toHaveBeenCalled();
});
