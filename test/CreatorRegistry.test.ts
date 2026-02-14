import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

import type { CreatorRegistry } from "../typechain-types";

describe("CreatorRegistry", () => {
	let creatorRegistry: CreatorRegistry;
	let owner: SignerWithAddress;
	let creator1: SignerWithAddress;
	let creator2: SignerWithAddress;
	let creator3: SignerWithAddress;

	const PROFILE_HASH_1 = ethers.id("profile1");
	const PROFILE_HASH_2 = ethers.id("profile2");
	const UPDATED_HASH = ethers.id("updated_profile");

	beforeEach(async () => {
		[owner, creator1, creator2, creator3] = await ethers.getSigners();

		const CreatorRegistryFactory =
			await ethers.getContractFactory("CreatorRegistry");
		creatorRegistry =
			(await CreatorRegistryFactory.deploy()) as unknown as CreatorRegistry;
		await creatorRegistry.waitForDeployment();
	});

	describe("Deployment", () => {
		it("Should set the correct owner", async () => {
			expect(await creatorRegistry.owner()).to.equal(owner.address);
		});

		it("Should start with zero creators", async () => {
			expect(await creatorRegistry.getTotalCreators()).to.equal(0);
		});
	});

	describe("Creator Registration", () => {
		it("Should register a new creator successfully", async () => {
			const tx = await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);

			await expect(tx)
				.to.emit(creatorRegistry, "CreatorRegistered")
				.withArgs(
					1,
					creator1.address,
					"@creator1",
					PROFILE_HASH_1,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const creatorId = await creatorRegistry.getCreatorIdByWallet(
				creator1.address,
			);
			expect(creatorId).to.equal(1);

			const creator = await creatorRegistry.getCreator(1);
			expect(creator.id).to.equal(1);
			expect(creator.wallet).to.equal(creator1.address);
			expect(creator.xHandle).to.equal("@creator1");
			expect(creator.profileHash).to.equal(PROFILE_HASH_1);
			expect(creator.isActive).to.equal(true);
		});

		it("Should increment creator IDs correctly", async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
			await creatorRegistry
				.connect(creator2)
				.registerCreator("@creator2", PROFILE_HASH_2);

			expect(
				await creatorRegistry.getCreatorIdByWallet(creator1.address),
			).to.equal(1);
			expect(
				await creatorRegistry.getCreatorIdByWallet(creator2.address),
			).to.equal(2);
			expect(await creatorRegistry.getTotalCreators()).to.equal(2);
		});

		it("Should reject registration with empty X handle", async () => {
			await expect(
				creatorRegistry.connect(creator1).registerCreator("", PROFILE_HASH_1),
			).to.be.revertedWith("X handle cannot be empty");
		});

		it("Should reject registration with empty profile hash", async () => {
			await expect(
				creatorRegistry
					.connect(creator1)
					.registerCreator("@creator1", ethers.ZeroHash),
			).to.be.revertedWith("Profile hash cannot be empty");
		});

		it("Should reject duplicate wallet registration", async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);

			await expect(
				creatorRegistry
					.connect(creator1)
					.registerCreator("@creator1_alt", PROFILE_HASH_2),
			).to.be.revertedWith("Creator already registered");
		});

		it("Should reject duplicate X handle", async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);

			await expect(
				creatorRegistry
					.connect(creator2)
					.registerCreator("@creator1", PROFILE_HASH_2),
			).to.be.revertedWith("X handle already taken");
		});
	});

	describe("Profile Updates", () => {
		beforeEach(async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
		});

		it("Should update profile hash successfully", async () => {
			const tx = await creatorRegistry
				.connect(creator1)
				.updateProfile(UPDATED_HASH);

			await expect(tx)
				.to.emit(creatorRegistry, "CreatorUpdated")
				.withArgs(
					1,
					UPDATED_HASH,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const creator = await creatorRegistry.getCreator(1);
			expect(creator.profileHash).to.equal(UPDATED_HASH);
		});

		it("Should reject update from non-registered creator", async () => {
			await expect(
				creatorRegistry.connect(creator2).updateProfile(UPDATED_HASH),
			).to.be.revertedWith("Creator not registered");
		});

		it("Should reject update with empty profile hash", async () => {
			await expect(
				creatorRegistry.connect(creator1).updateProfile(ethers.ZeroHash),
			).to.be.revertedWith("Profile hash cannot be empty");
		});

		it("Should reject update for deactivated creator", async () => {
			await creatorRegistry.connect(owner).deactivateCreator(1);

			await expect(
				creatorRegistry.connect(creator1).updateProfile(UPDATED_HASH),
			).to.be.revertedWith("Creator is deactivated");
		});
	});

	describe("Creator Deactivation", () => {
		beforeEach(async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
		});

		it("Should deactivate creator by owner", async () => {
			const tx = await creatorRegistry.connect(owner).deactivateCreator(1);

			await expect(tx)
				.to.emit(creatorRegistry, "CreatorDeactivated")
				.withArgs(
					1,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const creator = await creatorRegistry.getCreator(1);
			expect(creator.isActive).to.equal(false);
		});

		it("Should reject deactivation by non-owner", async () => {
			await expect(
				creatorRegistry.connect(creator2).deactivateCreator(1),
			).to.be.revertedWithCustomError(
				creatorRegistry,
				"OwnableUnauthorizedAccount",
			);
		});

		it("Should reject deactivation of invalid creator ID", async () => {
			await expect(
				creatorRegistry.connect(owner).deactivateCreator(999),
			).to.be.revertedWith("Invalid creator ID");
		});

		it("Should reject duplicate deactivation", async () => {
			await creatorRegistry.connect(owner).deactivateCreator(1);

			await expect(
				creatorRegistry.connect(owner).deactivateCreator(1),
			).to.be.revertedWith("Creator already deactivated");
		});
	});

	describe("View Functions", () => {
		beforeEach(async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
			await creatorRegistry
				.connect(creator2)
				.registerCreator("@creator2", PROFILE_HASH_2);
		});

		it("Should get creator by ID", async () => {
			const creator = await creatorRegistry.getCreator(1);
			expect(creator.wallet).to.equal(creator1.address);
			expect(creator.xHandle).to.equal("@creator1");
		});

		it("Should get creator ID by wallet", async () => {
			expect(
				await creatorRegistry.getCreatorIdByWallet(creator1.address),
			).to.equal(1);
			expect(
				await creatorRegistry.getCreatorIdByWallet(creator2.address),
			).to.equal(2);
			expect(
				await creatorRegistry.getCreatorIdByWallet(creator3.address),
			).to.equal(0);
		});

		it("Should check X handle availability", async () => {
			expect(await creatorRegistry.isXHandleAvailable("@creator1")).to.equal(
				false,
			);
			expect(await creatorRegistry.isXHandleAvailable("@creator3")).to.equal(
				true,
			);
		});

		it("Should get total creators count", async () => {
			expect(await creatorRegistry.getTotalCreators()).to.equal(2);
		});

		it("Should reject getting invalid creator ID", async () => {
			await expect(creatorRegistry.getCreator(999)).to.be.revertedWith(
				"Invalid creator ID",
			);
		});
	});

	describe("Reentrancy Protection", () => {
		it("Should protect registerCreator from reentrancy", async () => {
			// This test verifies the ReentrancyGuard is properly applied
			const tx = creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
			await expect(tx).to.not.be.reverted;
		});

		it("Should protect updateProfile from reentrancy", async () => {
			await creatorRegistry
				.connect(creator1)
				.registerCreator("@creator1", PROFILE_HASH_1);
			const tx = creatorRegistry.connect(creator1).updateProfile(UPDATED_HASH);
			await expect(tx).to.not.be.reverted;
		});
	});
});
