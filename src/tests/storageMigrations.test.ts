import { describe, expect, it } from "vitest";
import { METRICS_SCHEMA_VERSION, SETTINGS_SCHEMA_VERSION } from "../domain/settings/defaults";
import type { Metrics, Settings } from "../domain/settings/types";
import { mergeMetrics, mergeSettings } from "../infrastructure/storage";

describe("storage migrations by version", () => {
  it("migrates legacy settings v1 (without version) to current schema", () => {
    const legacyV1 = {
      blockEnabled: true,
      blockedDomains: ["YouTube.com"],
      whitelist: ["@Focus"],
      schedules: { 1: [{ start: "09:00", end: "10:00" }] }
    } as Partial<Settings>;

    const migrated = mergeSettings(legacyV1);
    expect(migrated.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(migrated.blockEnabled).toBe(true);
    expect(migrated.blockedDomains).toEqual(["youtube.com"]);
    expect(migrated.whitelist).toEqual(["@focus"]);
    expect(migrated.activeProfile).toBe("adult");
    expect(migrated.profiles.adult.blockedDomains).toEqual(["youtube.com"]);
  });

  it("migrates settings v2 to current schema and keeps normalized values", () => {
    const settingsV2 = {
      version: 2,
      theme: "dark",
      blockedDomains: ["tiktok.com"],
      blockedDomainTags: { "tiktok.com": ["por_semana"] },
      proEnabled: true
    } as Partial<Settings> & Record<string, unknown>;

    const migrated = mergeSettings(settingsV2 as Partial<Settings>);
    expect(migrated.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(migrated.theme).toBe("dark");
    expect(migrated.blockedDomains).toEqual(["tiktok.com"]);
    expect(migrated.blockedDomainTags["tiktok.com"]).toEqual(["por_semana"]);
    expect((migrated as unknown as Record<string, unknown>).proEnabled).toBeUndefined();
  });

  it("migrates metrics v1 to current schema", () => {
    const metricsV1 = {
      version: 1,
      attemptsByDay: { "2024-01-01": 2 },
      lastAttemptAt: 1704103200000
    } as Partial<Metrics>;

    const migrated = mergeMetrics(metricsV1);
    expect(migrated.version).toBe(METRICS_SCHEMA_VERSION);
    expect(migrated.attemptsByDay["2024-01-01"]).toBe(2);
    expect(migrated.lastAttemptAt).toBe(1704103200000);
    expect(migrated.lastAttemptUrl).toBeNull();
  });

  it("keeps metrics current version values", () => {
    const current = {
      version: METRICS_SCHEMA_VERSION,
      attemptsByDay: { "2024-01-10": 4 },
      lastAttemptUrl: "https://youtube.com/watch?v=abc"
    } as Partial<Metrics>;

    const merged = mergeMetrics(current);
    expect(merged.version).toBe(METRICS_SCHEMA_VERSION);
    expect(merged.attemptsByDay["2024-01-10"]).toBe(4);
    expect(merged.lastAttemptUrl).toBe("https://youtube.com/watch?v=abc");
  });
});
