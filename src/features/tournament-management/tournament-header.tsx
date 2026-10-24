import { Info, Plus } from "lucide-react";
import {
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import type { Tournament } from "../../shared/api/arena-api";
import { Modal } from "../../shared/ui/primitives";
import { TournamentActions } from "./tournament-actions";

interface HeaderActionProps {
  label: string;
  children: ReactNode;
  onClick: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}
function HeaderAction({
  label,
  children,
  onClick,
  buttonRef,
}: HeaderActionProps): ReactElement {
  const [tooltip, setTooltip] = useState<boolean>(false);
  const tooltipId = useId();
  return (
    <span
      className="header-icon-action"
      onMouseEnter={(): void => setTooltip(true)}
      onMouseLeave={(): void => setTooltip(false)}
    >
      <button
        type="button"
        className="icon-button"
        ref={buttonRef}
        aria-label={label}
        aria-describedby={tooltip ? tooltipId : undefined}
        onFocus={(): void => setTooltip(true)}
        onBlur={(): void => setTooltip(false)}
        onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>): void => {
          if (event.key === "Escape" && tooltip) {
            event.preventDefault();
            event.stopPropagation();
            setTooltip(false);
          }
        }}
        onClick={(): void => {
          setTooltip(false);
          onClick();
        }}
      >
        {children}
      </button>
      {tooltip && (
        <span role="tooltip" id={tooltipId}>
          {label}
        </span>
      )}
    </span>
  );
}
interface InformationRow {
  label: string;
  value: string;
}
interface TournamentInformationProps {
  tournament: Tournament;
  admin: boolean;
  onClose: () => void;
}
function stageExplanation(t: Tournament): string {
  if (t.status === "DRAFT")
    return "Review the matchups before starting. Teams and rules lock when play begins.";
  if (t.status === "COMPLETED")
    return "The tournament is complete. Saved results remain available for review.";
  if (t.qualificationPreview && !t.qualification)
    return "Your qualifiers are ready. Review the advancing teams, then build the first knockout round.";
  if (t.knockoutEligibility && t.rounds[0]?.method !== "FIXED")
    return `Build knockout round ${t.knockoutEligibility.round}. Choose opponents${t.knockoutEligibility.byeCount ? " and assign byes" : ""} for the remaining teams.`;
  if (t.currentStage === "GROUP")
    return "The group stage is in play. Finish all group fixtures and resolve ties across qualification places.";
  if (t.currentStage === "KNOCKOUT")
    return "Win the tie to advance. Each round finishes before the next begins. No away-goals rule applies.";
  return "Matches can be played in any order. Ranked by points, score difference, then score for; admins resolve remaining ties.";
}
function TournamentInformation({
  tournament: t,
  admin,
  onClose,
}: TournamentInformationProps): ReactElement {
  const champion = t.entrants.find(
    (entrant: Tournament["entrants"][number]): boolean =>
      entrant.id === t.championId,
  );
  const rows: InformationRow[] = [
    { label: "Tournament name", value: t.name },
    {
      label: "Game",
      value: t.game === "EFOOTBALL" ? "eFootball" : "Call of Duty: Mobile",
    },
    {
      label: "Tournament type",
      value:
        t.format === "LEAGUE"
          ? "Round robin league"
          : t.format === "WORLD_CUP"
            ? "Group + knockout"
            : "Only knockout",
    },
    { label: "Teams", value: String(t.entrants.length) },
    { label: "Tournament ID", value: t.publicId },
    {
      label: "Status",
      value:
        t.status === "DRAFT"
          ? "Draft"
          : t.status === "COMPLETED"
            ? "Completed"
            : "In play",
    },
    {
      label: "Current stage",
      value:
        t.currentStage === "GROUP"
          ? "Group stage"
          : t.currentStage === "KNOCKOUT"
            ? "Knockout"
            : t.currentStage === "SETUP"
              ? "Setup"
              : "League",
    },
    { label: "Match stats", value: t.statsEnabled ? "Enabled" : "Not enabled" },
    {
      label: "Viewing mode",
      value: admin ? "Admin view" : "Public view · refreshes every 15s",
    },
  ];
  if (t.format !== "KNOCKOUT")
    rows.push(
      { label: "Round-robin legs", value: String(t.legs) },
      {
        label: "Points",
        value: `${t.winPoints} for a win · ${t.drawPoints} for a draw · ${t.lossPoints} for a loss`,
      },
    );
  if (t.format !== "LEAGUE")
    rows.push(
      { label: "Knockout legs", value: String(t.knockoutLegs) },
      { label: "Final legs", value: String(t.knockoutFinalLegs) },
    );
  if (t.groups.length)
    rows.push({ label: "Groups", value: String(t.groups.length) });
  for (const group of t.groups)
    rows.push({
      label: group.name,
      value: `Top ${group.qualifierCount} advance`,
    });
  if (champion) rows.push({ label: "Champion", value: champion.name });
  return (
    <Modal title="Tournament information" onClose={onClose}>
      <dl className="tournament-information">
        {rows.map((row: InformationRow): ReactElement => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="tournament-stage-explanation">{stageExplanation(t)}</p>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
interface TournamentHeaderProps {
  tournament: Tournament;
  admin: boolean;
  actions: ReactNode;
  children?: ReactNode;
  onEnter?: () => void;
  resultTriggerRef: RefObject<HTMLButtonElement | null>;
}
export function TournamentHeader({
  tournament: t,
  admin,
  actions,
  children,
  onEnter,
  resultTriggerRef,
}: TournamentHeaderProps): ReactElement {
  const [information, setInformation] = useState<boolean>(false);
  const finished = t.matches.filter(
    (match: Tournament["matches"][number]): boolean => match.homeScore !== null,
  ).length;
  const percentage = t.matches.length
    ? Math.round((finished / t.matches.length) * 100)
    : 0;
  return (
    <>
      <header className="compact-tournament-header">
        <div className="compact-title-row">
          <h1>{t.name}</h1>
          <div className="tournament-title-controls">
            <HeaderAction
              label="Tournament information"
              onClick={(): void => setInformation(true)}
            >
              <Info aria-hidden="true" size={20} />
            </HeaderAction>
            {onEnter && (
              <HeaderAction
                label="Enter result"
                buttonRef={resultTriggerRef}
                onClick={onEnter}
              >
                <Plus aria-hidden="true" size={20} />
              </HeaderAction>
            )}
            <TournamentActions>{actions}</TournamentActions>
          </div>
        </div>
        <div className="compact-tournament-progress">
          <p>
            {finished}/{t.matches.length} matches ({percentage}%)
          </p>
          {children}
        </div>
      </header>
      {information && (
        <TournamentInformation
          tournament={t}
          admin={admin}
          onClose={(): void => setInformation(false)}
        />
      )}
    </>
  );
}
