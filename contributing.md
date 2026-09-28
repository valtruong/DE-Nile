# Contributing to DE-Nile (CPSS P&ID Interface)

This explains how the team works together and how the repo is set up, so a new contributor (or a future you) can get productive quickly.

**Repo:** https://github.com/OkitaWasHere/DE-Nile

## Project Structure (Monorepo)
```
DE-Nile/
├── packages/
│   ├── react-frontend/     # P&ID renderer + editor (React + Vite, JavaScript)
│   └── express-backend/    # mock data feed / integration adapter (Node + Express)
├── .prettierrc
├── CONTRIBUTING.md
├── project-context.md
└── README.md
```
We're using plain JavaScript, not TypeScript, since the team is still building web dev fundamentals — revisit this later if it becomes a pain point.

## Getting Started
1. Clone the repo.
2. `cd packages/react-frontend && npm install`
3. `cd packages/express-backend && npm install`
4. Run the frontend dev server: `npm run dev` (from `react-frontend`)
5. Run the mock backend: `npm run dev` (from `express-backend`)

## Git Workflow
- `main` is always demoable. Never commit directly to it once initial setup is done.
- One task = one branch: `feature/short-description` or `fix/short-description`.
- Open a PR when ready. At least one teammate reviews and approves before merging.
- Pull before you start work each session — conflicts are much easier to resolve early and often than all at once.

## Code Style — Prettier
Installed at the repo root (`npm install -D prettier`). Config lives in `.prettierrc`:

| Option | Our Value | Why |
|---|---|---|
| `tabWidth` | 2 | Standard for JS/React |
| `useTabs` | false | Spaces, for consistent rendering across editors |
| `semi` | true | Explicit statement endings — fewer ASI surprises for a beginner team |
| `printWidth` | 80 | Keeps diagram/schema code readable in side-by-side review |
| `singleQuote` | true | Common in React codebases |
| `trailingComma` | all | Cleaner git diffs when adding a new object/array entry |
| `bracketSpacing` | true | Default — improves readability |
| `arrowParens` | always | Consistent regardless of argument count |

Run `npm run format` (script defined in `package.json`) to apply formatting repo-wide. Run this once, early, before real work starts — running it later on a branch full of unformatted code is a fast way to create merge conflicts.

## Code Style — ESLint
Installed per-package (frontend gets the React plugins; backend does not need them). Config lives in each package's `eslint.config.js`, based on the course-provided starter configs. Run `npm run lint` before opening a PR.

We are **not** hand-editing every rule right away — start from the recommended rule sets and only turn rules on/off as a team when they cause real friction.

## Commit Messages
Short, present tense:
```
Add valve symbol registry
Fix stale-state timeout not resetting
```

## Testing
- New rendering/logic changes should include at least a basic test (Vitest).
- All tests must pass in CI before merge.

## Using AI Tools (GenAI)
- See `project-context.md` before prompting an AI agent for this project — it lists what's confirmed vs. still open, so the agent doesn't invent test-stand policy or safety behavior that hasn't actually been decided.
- Note any AI-assisted code or docs briefly in the relevant PR description.

## Questions Outside the Team's Authority
Don't invent test-stand safety behavior, control logic, or data contracts with other NILE console teams — flag these as open questions in `project-context.md` instead of guessing.
