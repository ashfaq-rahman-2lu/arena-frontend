import type { Match, ResultInput } from "../../shared/api/arena-api";
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
export function scoresFromMatch(match: Match): DraftScores {
  return {
    home: match.homeScore?.toString() ?? "",
    away: match.awayScore?.toString() ?? "",
    homeTiebreak: match.homeTiebreak?.toString() ?? "",
    awayTiebreak: match.awayTiebreak?.toString() ?? "",
    winner: match.winnerId ?? "",
  };
}
export function resultPayload(
  scores: DraftScores,
  match: Match,
  tournamentRevision: number,
  clear: boolean = false,
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
