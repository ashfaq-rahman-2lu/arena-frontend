import userEvent from "@testing-library/user-event";
import { useState, ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Field, Modal } from "./primitives";
test("a field combines existing descriptions, hints, and validation errors", (): void => {
  render(
    <>
      <span id="existing">Already described</span>
      <Field label="Name" hint="Use your team name" error="Name is required">
        <input aria-describedby="existing" />
      </Field>
    </>,
  );
  expect(
    screen.getByRole("textbox", { name: "Name" }),
  ).toHaveAccessibleDescription(
    "Already described Use your team name Name is required",
  );
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
});
test("dialogs focus the first field and restore the trigger after closing", async (): Promise<void> => {
  function Example(): ReactElement {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={(): void => setOpen(true)}>Open editor</button>
        {open && (
          <Modal title="Editor" onClose={(): void => setOpen(false)}>
            <Field label="Name">
              <input />
            </Field>
          </Modal>
        )}
      </>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: "Open editor" });
  await userEvent.click(trigger);
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(trigger).toHaveFocus();
});
