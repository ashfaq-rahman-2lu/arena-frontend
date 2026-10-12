import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { tournament } from "../../test/fixtures";
import { RenameModal } from "./management-dialogs";

test("canceling dirty identity edits keeps the draft when discard is declined", async (): Promise<void> => {
  const close = vi.fn<() => void>();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <RenameModal
      t={tournament}
      entrantId="home"
      recovery={{
        conflicted: false,
        error: "",
        latest: tournament,
        onLatest: (): void => {},
        onReapply: (): void => {},
      }}
      onClose={close}
      onSave={async (): Promise<void> => {}}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Team name" });
  await userEvent.clear(input);
  await userEvent.type(input, "Unsaved name");
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(confirm).toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(input).toHaveValue("Unsaved name");
});
