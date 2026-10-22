import { ReactElement } from "react";
import { Suggestion } from "../../shared/api/arena-api";

type MatchStat = NonNullable<Suggestion["stats"]>[number];
interface ExtractedStatsProps {
  stats: MatchStat[];
  homeName: string;
  awayName: string;
  reversed: boolean;
}
function statValue(value: number | null, unit: MatchStat["unit"]): string {
  return value === null
    ? "Unreadable"
    : `${value}${unit === "percent" ? "%" : ""}`;
}
export function ExtractedStats({
  stats,
  homeName,
  awayName,
  reversed,
}: ExtractedStatsProps): ReactElement | null {
  if (stats.length === 0) return null;
  return (
    <div className="extracted-stats">
      {reversed && (
        <p>
          Screenshot sides reversed: left → {awayName}, right → {homeName}.
        </p>
      )}
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Match stats review"
      >
        <table aria-label="Extracted match stats">
          <caption>Extracted match stats</caption>
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col">Home · {homeName}</th>
              <th scope="col">Away · {awayName}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat: MatchStat): ReactElement => (
              <tr key={stat.key}>
                <th scope="row">{stat.label}</th>
                <td>
                  {statValue(reversed ? stat.away : stat.home, stat.unit)}
                </td>
                <td>
                  {statValue(reversed ? stat.home : stat.away, stat.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Stats are shown for review only. Saving a result saves the scores.</p>
    </div>
  );
}
