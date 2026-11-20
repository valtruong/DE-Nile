import { expect, test, type Page } from "@playwright/test";

const valveSelector =
  '.react-flow__node[data-id="pneumatic-valve1"]';
const pressureSelector =
  '.react-flow__node[data-id="pressure-transducer1"]';

// Observe the rendered canvas coordinates, never React component state.
async function equipmentPositions(page: Page) {
  return page
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          id: node.getAttribute("data-id"),
          position: (node as HTMLElement).style.transform
        }))
        .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))
    );
}

async function openMonitoring(page: Page) {
  await page.clock.install();
  // No backend, credentials, database, or hardware is needed for this story.
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Not signed in" }
    })
  );
  await page.goto("/?viewerDemo=1");
  await page
    .getByRole("button", { name: "Continue as viewer" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "DE-Nile diagram monitoring"
    })
  ).toBeVisible();
  await expect(page.locator(valveSelector)).toContainText(
    /OPEN|CLOSED/
  );
  await expect(page.locator(pressureSelector)).toContainText(
    /\d+\.\d kPa/
  );
  await expect(
    page.locator(".react-flow__edge").first()
  ).toBeVisible();
  // Freeze timers after rendering, before exercising the silence threshold.
  await page.clock.pauseAt(
    await page.evaluate(() => Date.now() + 1_000)
  );
  return equipmentPositions(page);
}

test("pausing telemetry shows stale text while keeping the diagram fixed", async ({
  page
}) => {
  const positions = await openMonitoring(page);
  expect(positions.length).toBeGreaterThan(0);
  await page
    .getByRole("checkbox", { name: "Pause simulated updates" })
    .check();
  await page.clock.runFor(5_100);
  await expect(page.locator(valveSelector)).toContainText(
    "Stale"
  );
  await expect(page.locator(valveSelector)).not.toContainText(
    /OPEN|CLOSED/
  );
  await expect(page.locator(pressureSelector)).toContainText(
    "Stale"
  );
  expect(await equipmentPositions(page)).toEqual(positions);
});

test("resuming telemetry restores current readings without moving equipment", async ({
  page
}) => {
  const positions = await openMonitoring(page);
  const pause = page.getByRole("checkbox", {
    name: "Pause simulated updates"
  });
  await pause.check();
  await page.clock.runFor(5_100);
  await expect(page.locator(valveSelector)).toContainText(
    "Stale"
  );
  await pause.uncheck();
  await page.clock.runFor(1_600);
  await expect(page.locator(valveSelector)).toContainText(
    /OPEN|CLOSED/
  );
  await expect(page.locator(valveSelector)).not.toContainText(
    "Stale"
  );
  await expect(page.locator(pressureSelector)).toContainText(
    /\d+\.\d kPa/
  );
  await expect(
    page.locator(pressureSelector)
  ).not.toContainText("Stale");
  expect(await equipmentPositions(page)).toEqual(positions);
});
