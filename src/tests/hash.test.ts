import { describe, expect, it, beforeAll } from "vitest";
import { hashPin, verifyPin } from "../shared/hash";

beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    const { webcrypto } = await import("node:crypto");
    // @ts-expect-error webcrypto type differs in Node typings
    globalThis.crypto = webcrypto;
  }
});

async function legacyHashPin(pin: string) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("hashPin / verifyPin", () => {
  it("generates a PBKDF2 hash with salt", async () => {
    const hash = await hashPin("1234");
    expect(hash.startsWith("pbkdf2$")).toBe(true);
    const parts = hash.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[1]).toMatch(/^\d+$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    expect(parts[3]).toMatch(/^[0-9a-f]+$/);
  });

  it("uses a unique salt per hash", async () => {
    const a = await hashPin("same-pin");
    const b = await hashPin("same-pin");
    expect(a).not.toBe(b);
  });

  it("verifies PBKDF2 hash", async () => {
    const hash = await hashPin("9999");
    const ok = await verifyPin("9999", hash);
    expect(ok.ok).toBe(true);
    expect(ok.needsUpgrade).toBe(false);
  });

  it("fails on wrong PIN", async () => {
    const hash = await hashPin("0000");
    const ok = await verifyPin("1111", hash);
    expect(ok.ok).toBe(false);
  });

  it("verifies legacy SHA-256 hash and marks for upgrade", async () => {
    const legacy = await legacyHashPin("4321");
    const ok = await verifyPin("4321", legacy);
    expect(ok.ok).toBe(true);
    expect(ok.needsUpgrade).toBe(true);
  });
});
