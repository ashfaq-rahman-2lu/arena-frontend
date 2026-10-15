import { expect, test } from "vitest";
import { importTeams } from "./import-draft";
import { newEntrant } from "./setup-draft";
test("imports independent names and aliases, preserving manual rows and skipping duplicates", (): void => {
  const current = [{ ...newEntrant(), name: "Alpha" }, newEntrant()];
  const result = importTeams(current, "source", [
    { id: "one", name: " alpha ", aliases: [] },
    { id: "two", name: "Beta", aliases: ["B"] },
  ]);
  expect(result.skipped).toEqual([" alpha "]);
  expect(result.entrants).toHaveLength(2);
  expect(result.entrants[0]).toEqual(current[0]);
  expect(result.entrants[1]).toMatchObject({
    name: "Beta",
    aliases: "B",
    importSourceId: "source",
    importEntrantId: "two",
  });
  expect(result.entrants[1].id).toBeUndefined();
  expect(
    importTeams(result.entrants, "source", [
      { id: "two", name: "Renamed Beta", aliases: [] },
    ]).entrants,
  ).toHaveLength(2);
  expect((): unknown =>
    importTeams(result.entrants, "another", [
      { id: "three", name: "Gamma", aliases: [] },
    ]),
  ).toThrow(/one source/i);
});
test("import capacity fails atomically without modifying the existing draft", (): void => {
  const current = Array.from(
    { length: 255 },
    (_: unknown, i: number): ReturnType<typeof newEntrant> => ({
      ...newEntrant(),
      name: `Team ${i}`,
    }),
  );
  const before = structuredClone(current);
  expect((): unknown =>
    importTeams(current, "source", [
      { id: "new1", name: "New one", aliases: [] },
      { id: "new2", name: "New two", aliases: [] },
    ]),
  ).toThrow(/256/);
  expect(current).toEqual(before);
});
