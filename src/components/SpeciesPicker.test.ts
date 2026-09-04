import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DUCK_SPECIES, duckSpecies, HABITAT_LABELS } from "@/lib/habitat";

describe("SpeciesPicker duck category", () => {
  const source = readFileSync(resolve(__dirname, "./SpeciesPicker.tsx"), "utf8");

  it("shows Inshore, Offshore, Shark, and Duck as four teal-selected groups", () => {
    expect(source).toContain('id: "saltwater-inshore"');
    expect(source).toContain('id: "saltwater-offshore"');
    expect(source).toContain('id: "shark"');
    expect(source).toContain('id: "duck"');
    expect(source).toContain('label: HABITAT_LABELS.duck');
    expect(source).toContain('data-testid={`species-group-${option.id}`}');
    expect(source).toContain("bg-teal text-white");
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("sm:grid-cols-4");
    expect(source).toContain(">Category</p>");
    expect(source).not.toContain(">Water</p>");
    expect(HABITAT_LABELS.duck).toBe("Duck");
  });

  it("opens the locked duck list and avoids calling ducks fish", () => {
    expect(source).toContain("duckSpecies()");
    expect(source).toContain("Search ducks or type a name");
    expect(source).toContain("Inshore, offshore, shark, or duck");
    expect(source).not.toMatch(/Search ducks.*fish/i);
    expect(duckSpecies()).toEqual([...DUCK_SPECIES]);
    expect(duckSpecies()).toHaveLength(14);
    expect(duckSpecies()[0]).toBe("Pintail");
    expect(duckSpecies()[12]).toBe("Bluebill");
    expect(duckSpecies()).not.toContain("Scaup");
  });
});
