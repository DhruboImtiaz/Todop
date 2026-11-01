import { test, expect } from "@playwright/test";
import type { AppDataSchema } from "../../src/types";
import { createBackup } from "../../src/utils/backup";
import { selectBackup } from "./helpers";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../../src/utils/settings";

test.use({ serviceWorkers: "block" });
const demoData = (
  page: import("@playwright/test").Page,
): Promise<AppDataSchema> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("todop_demo_v2")!));

test("My Day chooses three tasks, respects removal and survives reload", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Your focus", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add Turn those notes into a plan to My Day",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Add Explore the next good idea to My Day",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Log: Turn those notes into a plan,/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Log: Turn those notes into a plan,/ }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: 'Options for "Turn those notes into a plan"',
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove from My Day", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Add Explore the next good idea to My Day",
      exact: true,
    }),
  ).toBeEnabled();
  expect(
    (await demoData(page)).logs.find((l) => l.id === "notes")?.myDay,
  ).toBeUndefined();
});

test("custom recurrence creates one next occurrence and Undo reverses completion", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Log Name", { exact: true })
    .fill("A fortnightly ritual");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByLabel("Repeat", { exact: true }).selectOption("weekly");
  await page.getByLabel("Repeat interval", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Create Log", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Add A fortnightly ritual to My Day",
      exact: true,
    })
    .click();
  const previous = (await demoData(page)).logs.find(
    (l) => l.title === "A fortnightly ritual",
  )!;
  await page
    .getByRole("button", {
      name: 'Mark "A fortnightly ritual" as completed',
      exact: true,
    })
    .click();
  const after = await demoData(page);
  const completed = after.logs.find((l) => l.id === previous.id)!;
  const next = after.logs.find((l) => l.id === completed.nextOccurrenceId)!;
  expect(next.recurrence?.interval).toBe(2);
  expect(Date.parse(next.deadline!) - Date.parse(previous.deadline!)).toBe(
    14 * 86400000,
  );
  expect(completed.completed).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const reverted = await demoData(page);
  expect(reverted.logs.some((l) => l.id === next.id)).toBe(false);
  expect(reverted.logs.find((l) => l.id === previous.id)?.completed).toBe(
    false,
  );
});

test("deleted tasks can be undone and restored with their subtasks", async ({
  page,
}) => {
  await page.goto("/demo");
  const before = (await demoData(page)).logs.find((l) => l.id === "design")!;
  await page
    .getByRole("button", {
      name: 'Options for "Review the first design direction"',
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Log: Review the first design direction,/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Log: Review the first design direction,/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: 'Options for "Review the first design direction"',
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.goto("/trash?demo=1");
  await page
    .getByRole("button", {
      name: "Restore Review the first design direction",
      exact: true,
    })
    .click();
  const restored = (await demoData(page)).logs.find((l) => l.id === "design")!;
  expect(restored.subtasks).toEqual(before.subtasks);
  expect(restored.id).toBe(before.id);
  await expect(
    page.getByRole("button", {
      name: "Restore Review the first design direction",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("backups retain focus, recurrence and recently deleted records", async ({
  page,
}) => {
  await page.goto("/demo");
  const saved = await demoData(page);
  await page.goto("/settings?demo=1");
  await selectBackup(page, createBackup(saved));
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Restore Data", exact: false })
    .click();
  await expect(page.getByText(/DATA RESTORED:/)).toBeVisible();
  const restored = await demoData(page);
  expect(restored.logs.find((l) => l.id === "read")?.recurrence).toEqual(
    saved.logs.find((l) => l.id === "read")?.recurrence,
  );
  expect(restored.logs.find((l) => l.id === "design")?.myDay).toBe(
    saved.logs.find((l) => l.id === "design")?.myDay,
  );
  expect(restored.trash).toEqual(saved.trash);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
  ).toBeNull();
});

test("dashboard stays inside the viewport at mobile and desktop sizes", async ({
  page,
}) => {
  await page.goto("/demo");
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Your focus", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const panels = await page.locator(".day-grid > .workspace-panel").all();
    for (const panel of panels)
      await expect(async () => {
        const box = await panel.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }).toPass();
  }
});

test("legacy device storage migrates without changing the old copy", async ({
  page,
}) => {
  const legacy = {
    version: 1,
    logs: [],
    projects: [],
    settings: { theme: "light", fontSize: "medium" },
  };
  await page.addInitScript(
    ({ oldKey, newKey, data }) => {
      localStorage.removeItem(newKey);
      localStorage.setItem(oldKey, JSON.stringify(data));
    },
    { oldKey: LEGACY_STORAGE_KEY, newKey: STORAGE_KEY, data: legacy },
  );
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: "Your focus", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    ({ oldKey, newKey }) => ({
      old: JSON.parse(localStorage.getItem(oldKey)!),
      next: JSON.parse(localStorage.getItem(newKey)!),
    }),
    { oldKey: LEGACY_STORAGE_KEY, newKey: STORAGE_KEY },
  );
  expect(saved.old).toEqual(legacy);
  expect(saved.next.version).toBe(2);
});

test("turning off repeat lets an incomplete interval be discarded", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Log Name", { exact: true }).fill("Just once");
  await page.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await page.getByLabel("Repeat interval", { exact: true }).fill("");
  await page.getByLabel("Repeat", { exact: true }).selectOption("none");
  await page.getByRole("button", { name: "Create Log", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add Just once to My Day", exact: true }),
  ).toBeVisible();
  expect(
    (await demoData(page)).logs.find((log) => log.title === "Just once")
      ?.recurrence,
  ).toBeUndefined();
});
