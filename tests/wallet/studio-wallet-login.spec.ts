import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import walletSetup from "../../test/wallet-setup/basic.setup";

const test = testWithSynpress(metaMaskFixtures(walletSetup));
const { expect } = test;

test.describe("Studio Wallet Login (Real Extension)", () => {
	test("connects wallet and enters studio route", async ({
		page,
		context,
		metamaskPage,
		extensionId,
	}) => {
		const walletPassword = process.env.WALLET_PASSWORD || "TestWallet123!";
		const metamask = new MetaMask(
			context,
			metamaskPage,
			walletPassword,
			extensionId,
		);

		await page.goto("/studio", { waitUntil: "domcontentloaded" });

		await expect(
			page.getByRole("heading", { name: /welcome to your creator workspace/i }),
		).toBeVisible();

		const metamaskDirectButton = page
			.getByRole("button", { name: /metamask/i })
			.first();
		const hasDirectButton = await metamaskDirectButton
			.isVisible({ timeout: 3000 })
			.catch(() => false);

		if (hasDirectButton) {
			await metamaskDirectButton.click();
		} else {
			const moreWalletsButton = page.getByRole("button", {
				name: /more wallets/i,
			});
			await expect(moreWalletsButton).toBeVisible();
			await moreWalletsButton.click();
		}

		await metamask.connectToDapp();

		await expect(page).toHaveURL(/\/studio(\/|$)/i);

		await expect(
			page.getByRole("heading", { name: /creator studio/i }),
		).toBeVisible();
	});
});
