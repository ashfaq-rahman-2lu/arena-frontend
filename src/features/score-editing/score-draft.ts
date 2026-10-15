import type {
  Match,
  ResultInput,
  Tournament,
  KnockoutTie,
} from "../../shared/api/arena-api";
import { parseInteger } from "../setup/setup-draft";
import { DraftScores } from "./suggestion-draft";
export class ScoreValidationError extends Error {
  constructor(
    public readonly field: keyof DraftScores,
    message: string,
  ) {
    super(message);
  }
}
export function scoresFromMatch(match: Match, t?: Tournament): DraftScores {
  const tie = t?.knockoutTies.find(
    (x: KnockoutTie): boolean => x.id === match.knockoutTieId && x.legs === 2,
  );
  return {
    home: match.homeScore?.toString() ?? "",
    away: match.awayScore?.toString() ?? "",
    homeTiebreak:
      (tie ? tie.homeTiebreak : match.homeTiebreak)?.toString() ?? "",
    awayTiebreak:
      (tie ? tie.awayTiebreak : match.awayTiebreak)?.toString() ?? "",
    winner: (tie ? tie.winnerId : match.winnerId) ?? "",
  };
}
export function resultPayload(
  scores: DraftScores,
  match: Match,
  tournamentRevision: number,
  clear: boolean = false,
  t?: Tournament,
): ResultInput {
  const required = (value: string, field: keyof DraftScores): number => {
    const number = parseInteger(value, 0, 2147483647);
    if (number === null)
      throw new ScoreValidationError(
        field,
        "Enter both final scores as non-negative whole numbers.",
      );
    return number;
  };
  const optional = (value: string, field: keyof DraftScores): number | null =>
    value === "" ? null : required(value, field);
  const context = t ? aggregateDraft(t, match, scores) : null;
  if (context?.tie.legs === 2) {
    const body: ResultInput = {
      homeScore: clear ? null : required(scores.home, "home"),
      awayScore: clear ? null : required(scores.away, "away"),
      homeTiebreak: null,
      awayTiebreak: null,
      winnerId: null,
      expectedRevision: match.revision,
      expectedTournamentRevision: tournamentRevision,
    };
    if (!clear && context.canDecide) {
      const h = optional(scores.homeTiebreak, "homeTiebreak"),
        a = optional(scores.awayTiebreak, "awayTiebreak");
      if ((h === null) !== (a === null))
        throw new ScoreValidationError(
          "homeTiebreak",
          "Enter both tiebreak scores.",
        );
      let winnerId = scores.winner || null;
      if (h !== null && a !== null) {
        if (h === a)
          throw new ScoreValidationError(
            "homeTiebreak",
            "Tiebreak scores must decide a winner.",
          );
        winnerId = h > a ? context.tie.homeId : context.tie.awayId;
      }
      if (
        winnerId &&
        winnerId !== context.tie.homeId &&
        winnerId !== context.tie.awayId
      )
        throw new ScoreValidationError("winner", "Choose a team in this tie.");
      if (winnerId)
        body.knockoutDecision = { homeTiebreak: h, awayTiebreak: a, winnerId };
    }
    return body;
  }
  const homeScore = clear ? null : required(scores.home, "home"),
    awayScore = clear ? null : required(scores.away, "away");
  const homeTiebreak =
      clear || homeScore !== awayScore
        ? null
        : optional(scores.homeTiebreak, "homeTiebreak"),
    awayTiebreak =
      clear || homeScore !== awayScore
        ? null
        : optional(scores.awayTiebreak, "awayTiebreak");
  if ((homeTiebreak === null) !== (awayTiebreak === null))
    throw new ScoreValidationError(
      homeTiebreak === null ? "homeTiebreak" : "awayTiebreak",
      "Enter both tiebreak scores.",
    );
  let winnerId =
    clear || match.stage !== "KNOCKOUT" || homeScore !== awayScore
      ? null
      : scores.winner || null;
  if (!clear && match.stage === "KNOCKOUT" && homeScore === awayScore) {
    if (homeTiebreak !== null && awayTiebreak !== null) {
      if (homeTiebreak === awayTiebreak)
        throw new ScoreValidationError(
          "homeTiebreak",
          "Tiebreak scores must decide a winner.",
        );
      winnerId = homeTiebreak > awayTiebreak ? match.homeId : match.awayId;
    }
    if (winnerId !== match.homeId && winnerId !== match.awayId)
      throw new ScoreValidationError(
        "winner",
        "Choose a winner for the tied knockout match.",
      );
  }
  return {
    homeScore,
    awayScore,
    homeTiebreak,
    awayTiebreak,
    winnerId,
    expectedRevision: match.revision,
    expectedTournamentRevision: tournamentRevision,
  };
}

export interface AggregateDraft {
  tie: KnockoutTie;
  homeAggregate: number;
  awayAggregate: number;
  canDecide: boolean;
}
export function aggregateDraft(
  t: Tournament,
  match: Match,
  scores: DraftScores,
): AggregateDraft | null {
  const tie = t.knockoutTies.find(
    (x: KnockoutTie): boolean => x.id === match.knockoutTieId && x.legs === 2,
  );
  if (!tie) return null;
  const h = parseInteger(scores.home, 0, 2147483647),
    a = parseInteger(scores.away, 0, 2147483647);
  const legs = t.matches
    .filter((m: Match): boolean => m.knockoutTieId === tie.id)
    .map((m: Match): Match =>
      m.id === match.id ? { ...m, homeScore: h, awayScore: a } : m,
    );
  let homeAggregate = 0,
    awayAggregate = 0;
  for (const m of legs) {
    homeAggregate += (m.homeId === tie.homeId ? m.homeScore : m.awayScore) ?? 0;
    awayAggregate += (m.homeId === tie.awayId ? m.homeScore : m.awayScore) ?? 0;
  }
  return {
    tie,
    homeAggregate,
    awayAggregate,
    canDecide:
      match.leg === 2 &&
      legs.length === 2 &&
      legs.every(
        (m: Match): boolean => m.homeScore !== null && m.awayScore !== null,
      ) &&
      homeAggregate === awayAggregate,
  };
}
