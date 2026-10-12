import { APIResponse, Page } from "@playwright/test";
import Ajv from "ajv";
import { readFileSync } from "node:fs";
import type { Match, Session, Tournament } from "../src/shared/api/arena-api";
const contract: unknown = JSON.parse(
  readFileSync("contracts/openapi.json", "utf8"),
);
if (!contract || typeof contract !== "object" || !("components" in contract))
  throw new Error("Missing contract");
const validator = new Ajv({ strict: false, validateFormats: false });
validator.addSchema({ $id: "arena", components: contract.components });
export async function response<T>(
  result: APIResponse,
  schema: string,
): Promise<T> {
  if (!result.ok()) throw new Error(await result.text());
  const value: unknown = await result.json();
  const valid = validator.compile<T>({
    $ref: `arena#/components/schemas/${schema}`,
  });
  if (!valid(value)) throw new Error(validator.errorsText(valid.errors));
  return value;
}
export async function completeCupFixture(
  page: Page,
  id: string,
): Promise<Tournament> {
  const session = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  const headers = { "X-CSRF-Token": session.csrf };
  let t = await response<Tournament>(
    await page.request.get(`/api/v1/tournaments/${id}`),
    "TournamentView",
  );
  for (const original of t.matches) {
    const match = t.matches.find((m: Match): boolean => m.id === original.id);
    if (!match) throw new Error("Missing fixture");
    t = await response<Tournament>(
      await page.request.patch(`/api/v1/matches/${match.id}/result`, {
        headers,
        data: {
          homeScore: 2,
          awayScore: 1,
          expectedRevision: match.revision,
          expectedTournamentRevision: t.revision,
        },
      }),
      "TournamentView",
    );
  }
  t = await response<Tournament>(
    await page.request.post(`/api/v1/tournaments/${id}/qualification`, {
      headers,
      data: { expectedRevision: t.revision },
    }),
    "TournamentView",
  );
  while (t.status !== "COMPLETED") {
    const ids = t.knockoutEligibility?.entrantIds;
    if (!ids) throw new Error("Cup must have eligible teams");
    const pairs: [string, string][] = [];
    for (let index = 0; index < ids.length; index += 2)
      pairs.push([ids[index], ids[index + 1]]);
    t = await response<Tournament>(
      await page.request.post(`/api/v1/tournaments/${id}/rounds`, {
        headers,
        data: { pairs, byes: [], expectedRevision: t.revision },
      }),
      "TournamentView",
    );
    for (const original of t.matches.filter(
      (m: Match): boolean => m.stage === "KNOCKOUT" && m.homeScore === null,
    )) {
      const match = t.matches.find((m: Match): boolean => m.id === original.id);
      if (!match) throw new Error("Missing match");
      t = await response<Tournament>(
        await page.request.patch(`/api/v1/matches/${match.id}/result`, {
          headers,
          data: {
            homeScore: 3,
            awayScore: 0,
            expectedRevision: match.revision,
            expectedTournamentRevision: t.revision,
          },
        }),
        "TournamentView",
      );
    }
  }
  return t;
}
