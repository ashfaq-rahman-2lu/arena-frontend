import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
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
interface NavigationMeasurements {
  width: number;
  more: number;
  gap: number;
  tabs: Record<string, number>;
}
function fittingSections(
  sections: TournamentSection[],
  active: string,
  measurements: NavigationMeasurements | null,
): TournamentSection[] {
  if (!measurements || measurements.width <= 0) return sections;
  const width = (items: TournamentSection[], more: boolean): number =>
    items.reduce(
      (total: number, item: TournamentSection): number =>
        total + (measurements.tabs[item.value] ?? 0),
      0,
    ) +
    (more ? measurements.more : 0) +
    Math.max(0, items.length - (more ? 0 : 1)) * measurements.gap;
  if (width(sections, false) <= measurements.width) return sections;
  const selected = sections.find(
    (section: TournamentSection): boolean => section.value === active,
  );
  for (let count = sections.length - 1; count > 0; count--) {
    let candidate = sections.slice(0, count);
    if (selected && !candidate.includes(selected))
      candidate = [...candidate.slice(0, -1), selected];
    if (width(candidate, true) <= measurements.width) return candidate;
  }
  return selected ? [selected] : sections.slice(0, 1);
}
function moveFocus(
  event: KeyboardEvent<HTMLButtonElement>,
  selector: string,
  activate: boolean,
): void {
  const controls = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      selector,
    ) ?? [],
  );
  const index = controls.indexOf(event.currentTarget);
  const next =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (index + 1) % controls.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
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
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  const [measurements, setMeasurements] =
    useState<NavigationMeasurements | null>(null);
  const navigation = useRef<HTMLElement>(null);
  const measurement = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const morePanel = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const lastMeasurement = useRef<string>("");
  const pendingActivation = useRef<string | null>(null);
  const menuId = useId();
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
  const sectionKey = sections
    .map((section: TournamentSection): string => section.value)
    .join(":");
  const primary = fittingSections(sections, active, measurements);
  const secondary = sections.filter(
    (section: TournamentSection): boolean => !primary.includes(section),
  );
  const visibleKey = primary
    .map((section: TournamentSection): string => section.value)
    .join(":");
  useLayoutEffect((): (() => void) => {
    let cancelled = false;
    const measure = (): void => {
      if (!navigation.current || !measurement.current || cancelled) return;
      const tabs: Record<string, number> = {};
      for (const element of measurement.current.querySelectorAll<HTMLElement>(
        "[data-measure-tab]",
      ))
        tabs[element.dataset.measureTab ?? ""] =
          element.getBoundingClientRect().width;
      const next: NavigationMeasurements = {
        width: navigation.current.getBoundingClientRect().width,
        more:
          measurement.current
            .querySelector<HTMLElement>("[data-measure-more]")
            ?.getBoundingClientRect().width ?? 0,
        gap:
          Number.parseFloat(getComputedStyle(navigation.current).columnGap) ||
          4,
        tabs,
      };
      const signature = JSON.stringify(next);
      if (signature === lastMeasurement.current) return;
      lastMeasurement.current = signature;
      const focused = document.activeElement;
      if (
        !pendingActivation.current &&
        focused instanceof HTMLElement &&
        navigation.current.contains(focused) &&
        !measurement.current.contains(focused)
      )
        pendingFocus.current = focused.dataset.section ?? "more";
      setMoreOpen(false);
      setMeasurements(next);
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (navigation.current) observer?.observe(navigation.current);
    if (measurement.current)
      for (const element of measurement.current.children)
        observer?.observe(element);
    window.addEventListener("resize", measure);
    document.fonts?.addEventListener("loadingdone", measure);
    void document.fonts?.ready.then((): void => measure());
    return (): void => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [sectionKey]);
  useLayoutEffect((): void => {
    const target = pendingFocus.current;
    if (
      !target ||
      (pendingActivation.current && active !== pendingActivation.current)
    )
      return;
    pendingActivation.current = null;
    pendingFocus.current = null;
    const visible = navigation.current?.querySelector<HTMLButtonElement>(
      `[role="tab"][data-section="${target}"]`,
    );
    const overflow = morePanel.current?.querySelector<HTMLButtonElement>(
      `[data-section="${target}"]`,
    );
    if (visible) {
      visible.focus();
    } else if (!overflow || !moreOpen) {
      (
        moreButton.current ??
        navigation.current?.querySelector<HTMLButtonElement>(
          '[aria-selected="true"]',
        )
      )?.focus();
    }
  }, [visibleKey, moreOpen, active]);
  useEffect((): (() => void) | undefined => {
    if (!moreOpen || !secondary.length) return;
    morePanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !navigation.current?.contains(event.target)
      )
        setMoreOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return (): void => document.removeEventListener("pointerdown", outside);
  }, [moreOpen, secondary.length]);
  return (
    <nav
      ref={navigation}
      className="tournament-navigation"
      aria-label="Tournament navigation"
    >
      <div
        ref={measurement}
        className="navigation-measurements"
        aria-hidden="true"
        inert
      >
        {sections.map((section: TournamentSection): ReactElement => (
          <span
            className="navigation-tab-measure"
            data-measure-tab={section.value}
            key={section.value}
          >
            {section.label}
          </span>
        ))}
        <span className="navigation-more-measure" data-measure-more>
          More
          <ChevronDown size={14} />
        </span>
      </div>
      <div
        className="tabs tournament-tabs"
        role="tablist"
        aria-label="Tournament sections"
      >
        {primary.map((section: TournamentSection): ReactElement => (
          <button
            type="button"
            role="tab"
            id={`tab-${section.value}`}
            data-section={section.value}
            aria-controls={`panel-${section.value}`}
            aria-selected={active === section.value}
            tabIndex={active === section.value ? 0 : -1}
            key={section.value}
            className={active === section.value ? "active" : ""}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void =>
              moveFocus(event, '[role="tab"]', true)
            }
            onClick={(): void => {
              onChange(section.value);
              setMoreOpen(false);
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
      {secondary.length > 0 && (
        <>
          <button
            type="button"
            className="more-sections"
            ref={moreButton}
            aria-label="More sections"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls={menuId}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMoreOpen(true);
              } else if (event.key === "Escape" && moreOpen) {
                event.preventDefault();
                setMoreOpen(false);
              }
            }}
            onClick={(): void => setMoreOpen(!moreOpen)}
          >
            More
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <div
            id={menuId}
            ref={morePanel}
            className="more-section-tabs"
            role="menu"
            aria-label="More tournament sections"
            hidden={!moreOpen}
          >
            {secondary.map((section: TournamentSection): ReactElement => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active === section.value}
                key={section.value}
                data-section={section.value}
                tabIndex={-1}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setMoreOpen(false);
                    moreButton.current?.focus();
                  } else if (event.key === "Tab") {
                    setMoreOpen(false);
                    moreButton.current?.focus();
                  } else moveFocus(event, '[role="menuitemradio"]', false);
                }}
                onClick={(): void => {
                  pendingFocus.current = section.value;
                  pendingActivation.current = section.value;
                  onChange(section.value);
                  setMoreOpen(false);
                }}
              >
                <span>{section.label}</span>
                {active === section.value && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
