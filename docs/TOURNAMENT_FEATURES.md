# Tournament formats and management

The format choices are League, Group + knockout, and Only knockout. Owners can rename tournaments at any stage. Started league/group rosters accept additions according to stage rules; started knockout-only rosters are locked. Existing participant removal remains a draft-only operation.

## Design

Retain Arena's dark panel palette, lime primary actions, existing Inter type scale, spacing, and shared field/dialog/button components. Put name editing and additions beside tournament information. Keep pairing choices in a focused modal, with a readable ordered opening bracket and a separate confirmation. Present ties as cards grouped by round, with leg scores and aggregate outcomes together. Stack controls on narrow screens, wrap long names, and contain the bracket's horizontal scrolling. Primary actions are Save name, Add teams and schedule matches, Import selected teams, and Create round.

Forms retain failed drafts, announce errors/loading/success, prevent duplicate requests, and require explicit revision review. All controls use native keyboard-accessible elements. Imported teams are independent copies; source provenance exists only in the unsaved creation form.

Knockout leg settings are independent of round-robin legs. New tournaments default to one-match ties and a single-match final. Two-leg ties use aggregate scores with no away-goals rule; a tied aggregate permits tiebreak scores or a chosen winner. Fixed brackets advance only after the whole round finishes.

## Verification

On 2026-10-15: frontend typecheck, lint, production build, formatting, and 51 tests passed. Twelve desktop/mobile browser cases passed using the frontend API proxy, including imports, fixed brackets, aggregate decisions, league additions, and 256-team owner/public rendering. Browser tests include accessibility checks and screenshots; narrow/wide score-editor and mobile bracket screenshots were also inspected. Browser suites require a freshly seeded disposable fixture to keep dashboard pagination deterministic.

The separate-origin API browser run also passed all 12 desktop/mobile cases against freshly seeded fixtures (24 browser cases passed across proxy and separate-origin runs).
