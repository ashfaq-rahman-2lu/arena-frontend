import { useState, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { tournament } from "../../test/fixtures";
import { TeamFilter } from "./team-filter";

function Filter(): ReactElement {
  const [value, setValue] = useState<string>("home");
  return (
    <>
      <TeamFilter
        entrants={tournament.entrants}
        value={value}
        onChange={setValue}
      />
      <button>Outside</button>
      <output>{value}</output>
    </>
  );
}
test("typing narrows teams without committing until keyboard selection", async (): Promise<void> => {
  render(<Filter />);
  const input = screen.getByRole("combobox", { name: "Filter by team" });
  expect(input).toHaveValue("Alpha");
  await userEvent.click(input);
  expect(screen.getByRole("option", { name: "All teams" })).toBeVisible();
  await userEvent.type(input, "eT");
  expect(screen.getByRole("option", { name: "Beta" })).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "Alpha" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("home");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  expect(input).toHaveValue("Beta");
  expect(input).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("away");
  expect(input).toHaveAttribute("aria-expanded", "false");
});
test("unmatched and dismissed edits restore the committed selection; pointer can clear", async (): Promise<void> => {
  render(<Filter />);
  const input = screen.getByRole("combobox", { name: "Filter by team" });
  await userEvent.click(input);
  await userEvent.type(input, "missing");
  expect(screen.getByText("No teams found")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  expect(input).toHaveValue("Alpha");
  await userEvent.click(input);
  await userEvent.type(input, "Beta");
  await userEvent.click(screen.getByRole("button", { name: "Outside" }));
  expect(input).toHaveValue("Alpha");
  await userEvent.click(input);
  await userEvent.click(screen.getByRole("option", { name: "All teams" }));
  expect(input).toHaveValue("All teams");
});
test("stable IDs distinguish duplicate names and external selection changes update the input", async (): Promise<void> => {
  const onChange = vi.fn<(value: string) => void>();
  const entrants = [
    ...tournament.entrants,
    { ...tournament.entrants[0], id: "duplicate" },
  ];
  const { rerender } = render(
    <TeamFilter entrants={entrants} value="home" onChange={onChange} />,
  );
  const input = screen.getByRole("combobox", { name: "Filter by team" });
  await userEvent.click(input);
  const options = screen.getAllByRole("option", { name: "Alpha" });
  expect(options[0]).toHaveAttribute("aria-selected", "true");
  await userEvent.click(options[1]);
  expect(onChange).toHaveBeenCalledWith("duplicate");
  rerender(<TeamFilter entrants={entrants} value="away" onChange={onChange} />);
  expect(input).toHaveValue("Beta");
});
