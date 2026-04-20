import { expect, request, test, type Page } from "@playwright/test";

const TEST_USER = "e2e_test_user";
const TEST_PASS = "e2e_test_pass";

// Ensure the test user exists before any test runs.
test.beforeAll(async () => {
  const ctx = await request.newContext({ baseURL: "http://127.0.0.1:8000" });
  await ctx.post("/api/auth/signup", {
    data: { username: TEST_USER, password: TEST_PASS },
  });
  // Ignore 409 (user already exists from a previous run) — any other error
  // will surface when the tests try to log in.
  await ctx.dispose();
});

async function loginAs(page: Page, username = TEST_USER, password = TEST_PASS) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  // Wait for the board to finish loading from the API
  await page.waitForSelector('[data-testid^="column-"]');
}

test("redirects unauthenticated users to /login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("/login");
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
});

test("login with wrong credentials shows error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
});

test("loads the kanban board after login", async ({ page }) => {
  await loginAs(page);
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await loginAs(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card").first()).toBeVisible();
  // Persist check: reload and verify the card is still there
  await page.reload();
  await page.waitForSelector('[data-testid^="column-"]');
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Playwright card").first()
  ).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await loginAs(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const targetColumn = page.locator('[data-testid^="column-"]').nth(3);

  // Grab the first card in the first column by position
  const card = firstColumn.locator('[data-testid^="card-"]').first();
  const cardTitle = await card.locator("h4").textContent();

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) throw new Error("Unable to resolve drag coordinates.");

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(targetColumn.getByText(cardTitle!)).toBeVisible();
});

test("logout redirects to /login and board is inaccessible", async ({
  page,
}) => {
  await loginAs(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("/login");
  await page.goto("/");
  await page.waitForURL("/login");
});

test("AI sidebar opens, accepts a message, and shows the user bubble", async ({
  page,
}) => {
  await loginAs(page);

  // Open sidebar
  await page.getByRole("button", { name: /open ai assistant/i }).click();
  const sidebar = page.getByTestId("ai-sidebar");
  await expect(sidebar).toBeVisible();

  // Type and send a message
  await sidebar.getByLabel("Chat input").fill("Hello");
  await sidebar.getByRole("button", { name: /send/i }).click();

  // User bubble must appear immediately
  await expect(sidebar.getByText("Hello")).toBeVisible();

  // Close the sidebar
  await sidebar.getByRole("button", { name: /close ai sidebar/i }).click();
  // After closing, the sidebar slides off-screen (translate-x-full)
  await expect(sidebar).not.toBeInViewport();
});
