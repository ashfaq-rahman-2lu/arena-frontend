import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { tournament } from "../../test/fixtures";
import { TournamentNavigation } from "./tournament-navigation";
let available = 270;
let resize: () => void = (): void => {};
function geometry(): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement): DOMRect {
      const widths: Record<string, number> = {
        standings: 90,
        fixtures: 75,
        knockout: 85,
        teams: 65,
        stats: 90,
        history: 130,
      };
      const width =
        this.getAttribute("aria-label") === "Tournament navigation"
          ? available
          : this.dataset.measureTab
            ? (widths[this.dataset.measureTab] ?? 0)
            : this.hasAttribute("data-measure-more")
              ? 66
              : 0;
      return new DOMRect(0, 0, width, 44);
    },
  );
  class Observer {
    constructor(callback: ResizeObserverCallback) {
      resize = (): void => callback([], this);
    }
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  vi.stubGlobal("ResizeObserver", Observer);
}
function Navigation(): ReactElement {
  const [active, setActive] = useState<string>("standings");
  return (
    <>
      <TournamentNavigation
        tournament={{ ...tournament, format: "WORLD_CUP", statsEnabled: true }}
        admin
        active={active}
        onChange={setActive}
      />
      <button type="button">Outside</button>
    </>
  );
}
afterEach((): void => {
  vi.unstubAllGlobals();
});
test("navigation fits complete tabs, promotes the selected overflow section and dismisses with focus", async (): Promise<void> => {
  available = 270;
  geometry();
  render(<Navigation />);
  const strip = screen.getByRole("tablist", { name: "Tournament sections" });
  expect(
    within(strip)
      .getAllByRole("tab")
      .map((tab: HTMLElement): string | null => tab.textContent),
  ).toEqual(["Standings", "Fixtures"]);
  const more = screen.getByRole("button", { name: "More sections" });
  expect(more).toHaveTextContent(/^More$/);
  await userEvent.click(more);
  await userEvent.click(
    screen.getByRole("menuitemradio", { name: "Team stats" }),
  );
  expect(screen.getByRole("tab", { name: "Team stats" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tab", { name: "Team stats" })).toHaveFocus();
  expect(within(strip).getAllByRole("tab")).toHaveLength(2);
  await userEvent.click(more);
  await userEvent.keyboard("{End}");
  expect(
    screen.getByRole("menuitemradio", { name: "Revision history" }),
  ).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(more).toHaveFocus();
  await userEvent.click(more);
  await userEvent.click(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
test("resizing changes visible counts and moves focus safely when an overflow item disappears", async (): Promise<void> => {
  available = 360;
  geometry();
  render(<Navigation />);
  const strip = screen.getByRole("tablist", { name: "Tournament sections" });
  expect(within(strip).getAllByRole("tab")).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "More sections" }));
  expect(screen.getByRole("menuitemradio", { name: "Teams" })).toHaveFocus();
  available = 800;
  act((): void => resize());
  expect(within(strip).getAllByRole("tab")).toHaveLength(6);
  expect(
    screen.queryByRole("button", { name: "More sections" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Teams" })).toHaveFocus();
  available = 270;
  act((): void => resize());
  expect(within(strip).getAllByRole("tab")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "More sections" })).toHaveFocus();
});
test("overflow selection restores focus after an asynchronous route change", async (): Promise<void> => {
  available = 270;
  geometry();
  const onChange = vi.fn<(value: string) => void>();
  const props = {
    tournament: { ...tournament, statsEnabled: true },
    admin: true,
    onChange,
  };
  const view = render(<TournamentNavigation {...props} active="standings" />);
  await userEvent.click(screen.getByRole("button", { name: "More sections" }));
  await userEvent.click(
    screen.getByRole("menuitemradio", { name: "Team stats" }),
  );
  expect(onChange).toHaveBeenCalledWith("stats");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  view.rerender(<TournamentNavigation {...props} active="stats" />);
  expect(screen.getByRole("tab", { name: "Team stats" })).toHaveFocus();
});
test("public knockout navigation exposes only supported sections and adapts without owner history", async (): Promise<void> => {
  available = 800;
  geometry();
  render(
    <TournamentNavigation
      tournament={{ ...tournament, format: "KNOCKOUT", statsEnabled: true }}
      admin={false}
      active="knockout"
      onChange={(_value: string): void => {}}
    />,
  );
  expect(
    screen
      .getAllByRole("tab")
      .map((tab: HTMLElement): string | null => tab.textContent),
  ).toEqual(["Knockout", "Fixtures", "Teams", "Team stats"]);
  expect(
    screen.queryByRole("button", { name: "More sections" }),
  ).not.toBeInTheDocument();
  available = 270;
  act((): void => resize());
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "More sections" }));
  expect(
    screen.queryByRole("menuitemradio", { name: "Revision history" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("menuitemradio", { name: "Team stats" }),
  ).toBeVisible();
});
