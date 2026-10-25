import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { tournament } from "../../test/fixtures";
import { FixtureProgress } from "./fixture-progress";

test("shows selected-team progress without duplicating tournament totals", (): void => {
  render(<FixtureProgress tournament={tournament} teamId="home" />);
  expect(screen.getByText("Alpha: 1/1 matches played")).toBeVisible();
  expect(screen.queryByText(/Tournament:/)).not.toBeInTheDocument();
});
test("renders no extra progress row without a valid selected team", (): void => {
  const { container, rerender } = render(
    <FixtureProgress tournament={tournament} teamId="" />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(<FixtureProgress tournament={tournament} teamId="unknown" />);
  expect(container).toBeEmptyDOMElement();
});
