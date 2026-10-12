# Frontend development instructions

Before planning, testing, or changing anything in this repository, read and follow every rule in `.agents/rules/frontend-*.mdc` (paths relative to this file). These are the authoritative frontend development standards; their stated scope also covers this repository’s generated API contracts and CI work.

Mandatory requirements include test-first red-green-refactor development, named models/props, explicit parameter and return types on all handwritten functions and callbacks, accessible semantic UI, a coherent responsive design system, feature-owned components/hooks, typed API access, and safe asynchronous form workflows. Existing behavior is not automatically a requirement; document and test intentional changes against the agreed brief.

Generated API code must be regenerated rather than hand-edited and is exempt from handwritten signature/style requirements. Read the rules directly rather than assuming tools automatically discover `.agents/rules/` glob metadata. Consult the frontend-design skill for substantial visual work, using these project standards alongside the user's actual design brief.

This is an independently installable and deployable repository. Run npm commands here without workspace flags. Do not introduce runtime, build, test, or tooling dependencies on a sibling repository. Frontend browser tests may target an explicitly started backend test fixture; normal frontend checks must run without a backend checkout.
