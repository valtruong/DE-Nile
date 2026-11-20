# Testing

We use Vitest for unit tests and Playwright for browser tests. For TE7,
we focused on Part II (unit testing) and Part IV (UI testing): checking
how equipment readings are displayed and what happens when updates stop.

## Running the tests

Use Node.js 22.12 or a newer version supported by Vite 8. From the
repository root, run:

```sh
npm install
npm exec --workspace=de-nile -- playwright install chromium
npm test
```

The first two commands install the dependencies and test browser. Once
those are installed, these tests can run offline.

| Command | What it runs |
| --- | --- |
| `npm test` | All Vitest tests, followed by the browser tests |
| `npm run test:unit` | Vitest tests in the frontend and viewer packages |
| `npm run test:ui` | The two Playwright tests in Chromium |
| `npm run build` | Production builds of the viewer and frontend |
| `npm run lint` | Lint checks for both packages |

The root test commands build the viewer package before running tests,
since the frontend imports it. To run tests for just one package, build
it first:

```sh
npm run build --workspace=@de-nile/pid-viewer
npm run test:unit --workspace=de-nile
# Or test just the viewer package:
npm run test:unit --workspace=@de-nile/pid-viewer
```

To watch the browser tests run, build the viewer and use
`npm run test:ui:headed --workspace=de-nile`.

Playwright starts a local server on port 4175 and stops it when the tests
finish. Make sure that port is free. If a browser test fails, Playwright
saves a screenshot and trace in `packages/react-frontend/test-results/`.
To open the HTML report, run:

```sh
npm exec --workspace=de-nile -- playwright show-report
```

On Linux CI, you may need to install browser system dependencies too:

```sh
npm exec --workspace=de-nile -- playwright install --with-deps chromium
```

## Part II: unit tests

Unit tests check one function at a time. These four cases cover two
functions without needing to start the app:

| Function | Test | Expected result |
| --- | --- | --- |
| `normalizeVisualState` | Pass in valid tank readings | `full`, `half`, and `empty` map to the matching tank states |
| `normalizeVisualState` | Pass in an unsupported or missing tank reading | Returns `undefined` |
| `formatReading` | Pass in a pressure reading of zero | Displays `0.0 kPa` with the configured units and precision |
| `formatReading` | Leave the reading undefined | Displays `Unavailable` |

The tank tests are in
`packages/react-frontend/tests/componentStates.test.ts`. The reading tests
are in `packages/pid-viewer/tests/telemetry.test.ts`. Each row above is a
separate test. We also check that a string is rejected when a numeric
reading is expected.

These cases build on the project's existing Vitest tests. Zero and
missing data are worth checking separately: a sensor reporting zero
should look different from a sensor that has not supplied a reading.

## Part IV: UI tests

The browser tests cover this user story:

> As an operator, I want to see when equipment readings stop updating
> and when they start working again, without moving the diagram.

Both tests are in `packages/react-frontend/e2e/monitoring.spec.ts`.
They open the monitoring demo at `/?viewerDemo=1` and click
**Continue as viewer**.

1. **Pause updates.** Check that valve states, pressure readings, and a
   pipe are visible. Select **Pause simulated updates**, then advance
   the test clock past five seconds. The readings should say **Stale**,
   and the valve should no longer show a current OPEN or CLOSED state.
   Equipment positions should stay the same.
2. **Resume updates.** Pause until the readings become stale, then clear
   **Pause simulated updates**. After the next update, valve states and
   pressure readings should return and the stale text should disappear.
   Equipment positions should still match their starting positions.

Playwright controls the browser clock so the tests do not have to wait
five real seconds each time. The checks use the text and equipment
positions shown in the browser.

## Test data and setup

These tests do not need hardware, an account, a database, seed data, or
environment variables. Readings come from the local `createSimulation()`
function. Each UI test starts with a fresh browser session and supplies
a signed-out response for `/api/auth/me`, then enters through the guest
viewer button. The rest of the monitoring screen runs normally.

The root test command covers `react-frontend` and `pid-viewer`. It does
not run the separate Express backend's tests.

## Other TE7 requirements

System tests check that several parts of a feature work together. For
example, a system test could pass telemetry through the tag mapping and
check that the correct equipment gets the reading.

TDD means writing a failing test before implementing a behavior, making
it pass, and then cleaning up the code while keeping tests passing.
These additions test existing behavior, so they do not provide a new TDD
example for Part I. Part I's TDD write-up and Part III's two system tests
still need to be documented for the full assignment.

## What we would test next

The UI tests currently use desktop Chromium and simulated readings.
They do not test real sign-in, backend permissions, or a live RiverDash
connection. Screenshots help debug failures, but we do not compare them
automatically for visual changes.

Next, we would add coverage for smaller screens, Firefox and WebKit,
diagram saving and reopening, invalid imports, and editor undo/redo.
We would also check symbol labels and pipe connections after resizing.
