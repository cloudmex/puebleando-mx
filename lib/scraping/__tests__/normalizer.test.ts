import { EventUtils, Deduplicator } from "../normalizer";

// ---------------------------------------------------------------------------
// EventUtils.generateDedupHash
// ---------------------------------------------------------------------------
describe("EventUtils.generateDedupHash", () => {
  it("produces the same hash for identical inputs", () => {
    const a = EventUtils.generateDedupHash({ title: "Concierto Maná", start_date: "2026-04-01T20:00:00Z", city: "Sayulita" });
    const b = EventUtils.generateDedupHash({ title: "Concierto Maná", start_date: "2026-04-01T20:00:00Z", city: "Sayulita" });
    expect(a).toBe(b);
  });

  it("normalizes title case (uppercase == lowercase)", () => {
    const lower = EventUtils.generateDedupHash({ title: "festival del mar", start_date: "2026-05-10", city: "Sayulita" });
    const upper = EventUtils.generateDedupHash({ title: "Festival del Mar", start_date: "2026-05-10", city: "Sayulita" });
    expect(lower).toBe(upper);
  });

  it("normalizes start_date to date-only (time differences do not affect hash)", () => {
    const morning = EventUtils.generateDedupHash({ title: "Evento X", start_date: "2026-04-01T08:00:00Z", city: "PV" });
    const evening = EventUtils.generateDedupHash({ title: "Evento X", start_date: "2026-04-01T23:59:00Z", city: "PV" });
    expect(morning).toBe(evening);
  });

  it("produces different hashes for different dates", () => {
    const a = EventUtils.generateDedupHash({ title: "Evento X", start_date: "2026-04-01", city: "PV" });
    const b = EventUtils.generateDedupHash({ title: "Evento X", start_date: "2026-04-02", city: "PV" });
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different cities", () => {
    const a = EventUtils.generateDedupHash({ title: "Concierto", start_date: "2026-04-01", city: "Sayulita" });
    const b = EventUtils.generateDedupHash({ title: "Concierto", start_date: "2026-04-01", city: "Puerto Vallarta" });
    expect(a).not.toBe(b);
  });

  it("handles missing fields gracefully (no throw)", () => {
    expect(() => EventUtils.generateDedupHash({})).not.toThrow();
    expect(() => EventUtils.generateDedupHash({ title: "Solo título" })).not.toThrow();
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = EventUtils.generateDedupHash({ title: "Test", start_date: "2026-01-01", city: "CDMX" });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// EventUtils.generateSlug
// ---------------------------------------------------------------------------
describe("EventUtils.generateSlug", () => {
  it("produces only URL-safe characters (lowercase alphanumeric + hyphens)", () => {
    const slug = EventUtils.generateSlug("Día de Muertos — Sayulita 2026");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("removes accents", () => {
    const slug = EventUtils.generateSlug("Fórum Económico");
    expect(slug).not.toMatch(/[áéíóúüñ]/i);
  });

  it("collapses multiple spaces/hyphens to a single hyphen", () => {
    const slug = EventUtils.generateSlug("festival   del   mar");
    expect(slug).not.toContain("--");
    expect(slug).not.toContain("  ");
  });

  it("does not start or end with a hyphen", () => {
    const slug = EventUtils.generateSlug("  Evento con espacios  ");
    expect(slug).not.toMatch(/^-|-$/);
  });

  it("appends city tag when provided", () => {
    const slug = EventUtils.generateSlug("Concierto Maná", "Sayulita");
    expect(slug).toContain("sayulita");
  });

  it("truncates to 180 characters", () => {
    const longTitle = "a".repeat(200);
    expect(EventUtils.generateSlug(longTitle).length).toBeLessThanOrEqual(180);
  });

  it("two different events never produce the same slug (unless intentionally identical)", () => {
    const a = EventUtils.generateSlug("Evento A", "CDMX");
    const b = EventUtils.generateSlug("Evento B", "CDMX");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Deduplicator.isDuplicate
// ---------------------------------------------------------------------------
describe("Deduplicator.isDuplicate", () => {
  it("returns false when db is null/undefined", async () => {
    expect(await Deduplicator.isDuplicate("anyhash", null)).toBe(false);
    expect(await Deduplicator.isDuplicate("anyhash", undefined)).toBe(false);
  });

  it("detects a duplicate via Supabase mock", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "123" }, error: null }),
          }),
        }),
      }),
    };
    expect(await Deduplicator.isDuplicate("somehash", mockSupabase)).toBe(true);
  });

  it("returns false when Supabase finds no match", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };
    expect(await Deduplicator.isDuplicate("somehash", mockSupabase)).toBe(false);
  });

  it("returns false on Supabase error (fail-open)", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "DB error" } }),
          }),
        }),
      }),
    };
    expect(await Deduplicator.isDuplicate("somehash", mockSupabase)).toBe(false);
  });

  it("detects a duplicate via PG mock", async () => {
    const mockPg = {
      query: async () => ({ rows: [{ id: "123" }] }),
    };
    expect(await Deduplicator.isDuplicate("somehash", mockPg)).toBe(true);
  });

  it("returns false when PG finds no rows", async () => {
    const mockPg = {
      query: async () => ({ rows: [] }),
    };
    expect(await Deduplicator.isDuplicate("somehash", mockPg)).toBe(false);
  });

  it("returns false on PG error (fail-open)", async () => {
    const mockPg = {
      query: async () => { throw new Error("connection lost"); },
    };
    expect(await Deduplicator.isDuplicate("somehash", mockPg)).toBe(false);
  });
});
