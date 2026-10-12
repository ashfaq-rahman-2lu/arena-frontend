interface RuleMessage {
  ruleId: string | null;
}
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
const eslint = new ESLint();
test("enforcement rejects unsafe signatures and casts", async (): Promise<void> => {
  const [result] = await eslint.lintText(
    "export const invalid = (value: any) => value!.missing as unknown as string;",
    { filePath: "src/lint-fixture.tsx" },
  );
  for (const rule of [
    "@typescript-eslint/no-explicit-any",
    "@typescript-eslint/no-non-null-assertion",
    "@typescript-eslint/explicit-function-return-type",
    "arena/no-double-cast",
  ])
    assert(
      result.messages.some(
        (message: RuleMessage): boolean => message.ruleId === rule,
      ),
      `missing enforcement: ${rule}`,
    );
});
test("callbacks require explicit parameter annotations", async (): Promise<void> => {
  const [result] = await eslint.lintText("[1].map(value => value);", {
    filePath: "src/lint-fixture.tsx",
  });
  assert(
    result.messages.some(
      (message: RuleMessage): boolean =>
        message.ruleId === "arena/explicit-parameters",
    ),
  );
});
test("focusable scroll regions are allowed while plain divs are rejected", async (): Promise<void> => {
  const [region] = await eslint.lintText(
    'export const Region = (): React.JSX.Element => <div role="region" aria-label="Standings" tabIndex={0} />;',
    { filePath: "src/lint-fixture.tsx" },
  );
  const [plain] = await eslint.lintText(
    "export const Plain = (): React.JSX.Element => <div tabIndex={0} />;",
    { filePath: "src/lint-fixture.tsx" },
  );
  assert(
    !region.messages.some(
      (message: RuleMessage): boolean =>
        message.ruleId === "jsx-a11y/no-noninteractive-tabindex",
    ),
  );
  assert(
    plain.messages.some(
      (message: RuleMessage): boolean =>
        message.ruleId === "jsx-a11y/no-noninteractive-tabindex",
    ),
  );
});
