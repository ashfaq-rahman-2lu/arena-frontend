import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import type { Tournament } from "../../shared/api/arena-api";

interface TournamentSection {
  value: string;
  label: string;
}
interface TournamentNavigationProps {
  tournament: Tournament;
  admin: boolean;
  active: string;
  onChange: (section: string) => void;
}
function subscribeLayout(notify: () => void): () => void {
  const query = window.matchMedia?.("(max-width: 600px)");
  query?.addEventListener("change", notify);
  return (): void => query?.removeEventListener("change", notify);
}
function narrowLayout(): boolean {
  return window.matchMedia?.("(max-width: 600px)").matches ?? false;
}
function serverLayout(): boolean {
  return false;
}
function moveTab(
  event: KeyboardEvent<HTMLButtonElement>,
  activate: boolean = true,
): void {
  const controls = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    ) ?? [],
  );
  const index = controls.indexOf(event.currentTarget);
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % controls.length
      : event.key === "ArrowLeft"
        ? (index + controls.length - 1) % controls.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? controls.length - 1
            : -1;
  if (next >= 0 && controls[next]) {
    event.preventDefault();
    if (activate) controls[next].click();
    controls[next].focus();
  }
}
export function TournamentNavigation({
  tournament: t,
  admin,
  active,
  onChange,
}: TournamentNavigationProps): ReactElement {
  const narrow = useSyncExternalStore(
    subscribeLayout,
    narrowLayout,
    serverLayout,
  );
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const morePanel = useRef<HTMLDivElement>(null);
  const sections: TournamentSection[] = [
    t.format === "KNOCKOUT"
      ? { value: "knockout", label: "Knockout" }
      : { value: "standings", label: "Standings" },
    { value: "fixtures", label: "Fixtures" },
    ...(t.format === "WORLD_CUP"
      ? [{ value: "knockout", label: "Knockout" }]
      : []),
    { value: "teams", label: "Teams" },
    ...(t.statsEnabled ? [{ value: "stats", label: "Team stats" }] : []),
    ...(admin ? [{ value: "history", label: "Revision history" }] : []),
  ];
  const primary = narrow
    ? sections.filter((section: TournamentSection): boolean =>
        ["fixtures", "standings", "knockout"].includes(section.value),
      )
    : sections;
  const secondary = narrow
    ? sections.filter(
        (section: TournamentSection): boolean => !primary.includes(section),
      )
    : [];
  const selectedSecondary = secondary.find(
    (section: TournamentSection): boolean => section.value === active,
  );
  useEffect((): void => {
    if (moreOpen)
      (
        morePanel.current?.querySelector<HTMLButtonElement>(
          '[aria-selected="true"]',
        ) ?? morePanel.current?.querySelector<HTMLButtonElement>('[role="tab"]')
      )?.focus();
  }, [moreOpen]);
  const dismissMore = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === "Escape" && moreOpen) {
      event.preventDefault();
      setMoreOpen(false);
      moreButton.current?.focus();
    }
  };
  const renderTab = (
    section: TournamentSection,
    inMore: boolean = false,
  ): ReactElement => (
    <button
      type="button"
      role="tab"
      id={`tab-${section.value}`}
      aria-controls={`panel-${section.value}`}
      aria-selected={active === section.value}
      tabIndex={
        active === section.value ||
        (inMore && !selectedSecondary && section === secondary[0]) ||
        (!inMore && selectedSecondary && section === primary[0])
          ? 0
          : -1
      }
      key={section.value}
      className={active === section.value ? "active" : ""}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
        dismissMore(event);
        if (!event.defaultPrevented) moveTab(event, !inMore);
      }}
      onClick={(): void => {
        onChange(section.value);
        setMoreOpen(false);
        if (inMore) moreButton.current?.focus();
      }}
    >
      {section.label}
    </button>
  );
  return (
    <nav className="tournament-navigation" aria-label="Tournament navigation">
      <div
        className="tabs tournament-tabs"
        role="tablist"
        aria-label="Tournament sections"
      >
        {primary.map((section: TournamentSection): ReactElement =>
          renderTab(section),
        )}
      </div>
      {narrow && (
        <>
          <button
            type="button"
            className="button secondary small more-sections"
            ref={moreButton}
            onKeyDown={dismissMore}
            aria-label={`More sections${selectedSecondary ? `: ${selectedSecondary.label}` : ""}`}
            aria-expanded={moreOpen}
            aria-controls="more-tournament-sections"
            onClick={(): void => setMoreOpen(!moreOpen)}
          >
            More{selectedSecondary ? ` · ${selectedSecondary.label}` : ""}
          </button>
          <div
            id="more-tournament-sections"
            ref={morePanel}
            className="more-section-tabs"
            role="tablist"
            aria-label="More tournament sections"
            hidden={!moreOpen}
          >
            {secondary.map((section: TournamentSection): ReactElement =>
              renderTab(section, true),
            )}
          </div>
        </>
      )}
    </nav>
  );
}
