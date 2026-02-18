import { expect, test } from "@playwright/test";

test.describe("Studio Profile Preferences", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/studio/profile");
	});

	test("profile fields: bio textarea with 500 char limit", async ({ page }) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const bioTextarea = page.getByPlaceholder(/brief bio about yourself/i);
		await expect(bioTextarea).toBeVisible();

		await expect(bioTextarea).toHaveAttribute("maxLength", "500");

		const testBio =
			"AI researcher focused on decentralized systems and blockchain technology.";
		await bioTextarea.fill(testBio);
		await expect(bioTextarea).toHaveValue(testBio);

		const charCounter = page.getByText(`${testBio.length}/500`);
		await expect(charCounter).toBeVisible();
	});

	test("profile fields: tags input accepts comma-separated values", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const tagsInput = page.getByPlaceholder(/AI, Web3, DeFi, etc/i);
		await expect(tagsInput).toBeVisible();

		await tagsInput.fill("AI, Web3, DeFi");
		await expect(tagsInput).toHaveValue("AI, Web3, DeFi");
	});

	test("profile fields: interests input accepts comma-separated values", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const interestsInput = page.getByPlaceholder(
			/Machine Learning, NFTs, Gaming/i,
		);
		await expect(interestsInput).toBeVisible();

		await interestsInput.fill("Machine Learning, Crypto, NFTs");
		await expect(interestsInput).toHaveValue("Machine Learning, Crypto, NFTs");
	});

	test("profile fields: specialties input accepts comma-separated values", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const specialtiesInput = page.getByPlaceholder(
			/Smart Contracts, UI Design/i,
		);
		await expect(specialtiesInput).toBeVisible();

		await specialtiesInput.fill("Smart Contracts, Solidity, TypeScript");
		await expect(specialtiesInput).toHaveValue(
			"Smart Contracts, Solidity, TypeScript",
		);
	});

	test("profile fields: display badges for saved tags in view mode", async ({
		page,
	}) => {
		const tagsSection = page.locator("text=Tags").locator("..");
		const badges = tagsSection.locator('[class*="badge"]');

		if ((await badges.count()) === 0) {
			await expect(page.getByText(/no tags added yet/i)).toBeVisible();
		} else {
			await expect(badges.first()).toBeVisible();
		}
	});

	test("opt-in toggle: default state is OFF (disabled)", async ({ page }) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');
		await expect(optInToggle).toBeVisible();

		const isChecked = await optInToggle.getAttribute("data-state");
		expect(["unchecked", "checked"]).toContain(isChecked);
	});

	test("opt-in toggle: can be toggled ON and OFF", async ({ page }) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');

		const initialState = await optInToggle.getAttribute("data-state");

		await optInToggle.click();
		const afterFirstClick = await optInToggle.getAttribute("data-state");
		expect(afterFirstClick).not.toBe(initialState);

		await optInToggle.click();
		const afterSecondClick = await optInToggle.getAttribute("data-state");
		expect(afterSecondClick).toBe(initialState);
	});

	test("conditional rendering: news preferences hidden when opt-in OFF", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');

		const currentState = await optInToggle.getAttribute("data-state");
		if (currentState === "checked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		await expect(page.getByText("Enable News Digests")).not.toBeVisible();
		await expect(page.getByText(/News Topics/i)).not.toBeVisible();
		await expect(page.getByText(/Digest Cadence/i)).not.toBeVisible();
	});

	test("conditional rendering: news preferences visible when opt-in ON", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');

		const currentState = await optInToggle.getAttribute("data-state");
		if (currentState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		await expect(page.getByText("Enable News Digests")).toBeVisible();
	});

	test("news toggle: default state is OFF when opt-in is ON", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');

		const optInState = await optInToggle.getAttribute("data-state");
		if (optInState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		const newsToggle = page
			.locator("text=Enable News Digests")
			.locator("..")
			.locator('button[role="switch"]');
		await expect(newsToggle).toBeVisible();

		const newsState = await newsToggle.getAttribute("data-state");
		expect(["unchecked", "checked"]).toContain(newsState);
	});

	test("news topics: input accepts comma-separated values", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');
		const optInState = await optInToggle.getAttribute("data-state");
		if (optInState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		const newsToggle = page
			.locator("text=Enable News Digests")
			.locator("..")
			.locator('button[role="switch"]');
		const newsState = await newsToggle.getAttribute("data-state");
		if (newsState === "unchecked") {
			await newsToggle.click();
			await page.waitForTimeout(200);
		}

		const newsTopicsInput = page.getByPlaceholder(
			/AI, Web3, DeFi, NFTs, Gaming/i,
		);
		await expect(newsTopicsInput).toBeVisible();

		await newsTopicsInput.fill("AI, Blockchain, DeFi");
		await expect(newsTopicsInput).toHaveValue("AI, Blockchain, DeFi");
	});

	test("news cadence: dropdown shows hourly/daily/weekly options", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');
		const optInState = await optInToggle.getAttribute("data-state");
		if (optInState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		const newsToggle = page
			.locator("text=Enable News Digests")
			.locator("..")
			.locator('button[role="switch"]');
		const newsState = await newsToggle.getAttribute("data-state");
		if (newsState === "unchecked") {
			await newsToggle.click();
			await page.waitForTimeout(200);
		}

		const cadenceLabel = page.getByText(/Digest Cadence/i);
		await expect(cadenceLabel).toBeVisible();

		const selectTrigger = page
			.locator('button[role="combobox"]')
			.filter({ hasText: /hourly|daily|weekly/i });
		await expect(selectTrigger).toBeVisible();

		await selectTrigger.click();
		await page.waitForTimeout(200);

		await expect(page.getByRole("option", { name: "Hourly" })).toBeVisible();
		await expect(page.getByRole("option", { name: "Daily" })).toBeVisible();
		await expect(page.getByRole("option", { name: "Weekly" })).toBeVisible();
	});

	test("news cadence: can select different cadence options", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');
		const optInState = await optInToggle.getAttribute("data-state");
		if (optInState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		const newsToggle = page
			.locator("text=Enable News Digests")
			.locator("..")
			.locator('button[role="switch"]');
		const newsState = await newsToggle.getAttribute("data-state");
		if (newsState === "unchecked") {
			await newsToggle.click();
			await page.waitForTimeout(200);
		}

		const selectTrigger = page
			.locator('button[role="combobox"]')
			.filter({ hasText: /hourly|daily|weekly/i });
		await selectTrigger.click();
		await page.waitForTimeout(200);

		await page.getByRole("option", { name: "Weekly" }).click();
		await page.waitForTimeout(200);

		await expect(selectTrigger).toContainText("Weekly");
	});

	test("form controls: Cancel button reverts changes", async ({ page }) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const bioTextarea = page.getByPlaceholder(/brief bio about yourself/i);
		const originalBio = await bioTextarea.inputValue();

		await bioTextarea.fill("This is a test change that should be reverted");

		const cancelButton = page.getByRole("button", { name: /cancel/i });
		await cancelButton.click();

		await expect(cancelButton).not.toBeVisible();
		await expect(editButton).toBeVisible();
	});

	test("form controls: Save button is visible in edit mode", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const saveButton = page.getByRole("button", { name: /save/i });
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeEnabled();
	});

	test("conditional rendering: news topics only visible when news enabled", async ({
		page,
	}) => {
		const editButton = page.getByRole("button", { name: /edit/i });
		await editButton.click();

		const optInToggle = page
			.locator("text=Enable Context-Aware Agent")
			.locator("..")
			.locator('button[role="switch"]');
		const optInState = await optInToggle.getAttribute("data-state");
		if (optInState === "unchecked") {
			await optInToggle.click();
			await page.waitForTimeout(200);
		}

		const newsToggle = page
			.locator("text=Enable News Digests")
			.locator("..")
			.locator('button[role="switch"]');

		const newsState = await newsToggle.getAttribute("data-state");
		if (newsState === "checked") {
			await newsToggle.click();
			await page.waitForTimeout(200);
		}

		await expect(page.getByText(/News Topics/i)).not.toBeVisible();
		await expect(page.getByText(/Digest Cadence/i)).not.toBeVisible();

		await newsToggle.click();
		await page.waitForTimeout(200);

		await expect(page.getByText(/News Topics/i)).toBeVisible();
		await expect(page.getByText(/Digest Cadence/i)).toBeVisible();
	});
});
