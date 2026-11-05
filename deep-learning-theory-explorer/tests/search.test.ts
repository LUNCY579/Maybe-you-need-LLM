import { describe, it, expect } from "vitest";
import { searchCurriculum } from "../src/lib/search";

describe("search", () => {
  it("finds lessons by title", () => {
    const hits = searchCurriculum("universality");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe("lesson");
    expect(hits[0].route).toContain("/lessons/");
  });
  it("finds terms", () => {
    const hits = searchCurriculum("susceptibility");
    expect(hits.some(h => h.kind === "term")).toBe(true);
  });
  it("finds equations", () => {
    const hits = searchCurriculum("Kaiming");
    expect(hits.some(h => h.kind === "equation")).toBe(true);
  });
  it("finds questions and experiments", () => {
    expect(searchCurriculum("critical").some(h => h.kind === "question")).toBe(true);
    expect(searchCurriculum("power law").some(h => h.kind === "experiment")).toBe(true);
  });
  it("returns nothing for a short or empty query", () => {
    expect(searchCurriculum("")).toEqual([]);
    expect(searchCurriculum("a")).toEqual([]);
  });
  it("returns nothing for a query that matches nothing", () => {
    expect(searchCurriculum("zzzqqqxyzzy")).toEqual([]);
  });
  it("ranks a title match above a body match", () => {
    const hits = searchCurriculum("criticality");
    expect(hits.length).toBeGreaterThan(1);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
  });
  it("every hit carries a snippet and a route", () => {
    for (const h of searchCurriculum("kernel")) {
      expect(h.detail.length).toBeGreaterThan(0);
      expect(h.route.startsWith("/")).toBe(true);
    }
  });
  it("never reports the same entry twice", () => {
    for (const q of ["criticality", "susceptibility", "kernel", "representation"]) {
      const hits = searchCurriculum(q, 20);
      const keys = hits.map((h) => `${h.kind}:${h.id}`);
      expect(new Set(keys).size, `${q}: ${keys.join(", ")}`).toBe(keys.length);
    }
  });
  it("finds the theory atlas concepts", () => {
    const hits = searchCurriculum("quartic coupling");
    expect(hits.some((h) => h.kind === "concept")).toBe(true);
  });
  it("prefers a lesson over an assessment question for the same phrase", () => {
    const hits = searchCurriculum("Wick contraction");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe("lesson");
  });
  it("finds a thing whose words are in a different order", () => {
    // a reader types the words as they remember them, not as the book has them
    const hits = searchCurriculum("critical weight variance");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === "lesson")).toBe(true);
  });
  it("finds a thing by two words that are not adjacent", () => {
    const hits = searchCurriculum("width depth ratio");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.title.toLowerCase().includes("depth-to-width"))).toBe(true);
  });
  it("requires every word of the query to be present", () => {
    // "kernel" is everywhere; "gherkin" is nowhere
    expect(searchCurriculum("kernel gherkin")).toEqual([]);
  });
  it("ignores the words that carry no meaning", () => {
    const withStop = searchCurriculum("the depth-to-width ratio");
    const without = searchCurriculum("depth-to-width ratio");
    expect(withStop.length).toBeGreaterThan(0);
    expect(withStop[0].id).toBe(without[0].id);
  });
});
