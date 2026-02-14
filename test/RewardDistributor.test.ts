import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

import type { CreatorRegistry, RewardDistributor } from "../typechain-types";

describe("RewardDistributor", () => {
	let creatorRegistry: CreatorRegistry;
	let rewardDistributor: RewardDistributor;
	let owner: SignerWithAddress;
	let creator1: SignerWithAddress;
	let creator2: SignerWithAddress;
	let creator3: SignerWithAddress;

	const PROFILE_HASH_1 = ethers.id("profile1");
	const PROFILE_HASH_2 = ethers.id("profile2");
	const PROFILE_HASH_3 = ethers.id("profile3");

	beforeEach(async () => {
		[owner, creator1, creator2, creator3] = await ethers.getSigners();

		const CreatorRegistryFactory =
			await ethers.getContractFactory("CreatorRegistry");
		creatorRegistry =
			(await CreatorRegistryFactory.deploy()) as unknown as CreatorRegistry;
		await creatorRegistry.waitForDeployment();

		const RewardDistributorFactory =
			await ethers.getContractFactory("RewardDistributor");
		rewardDistributor = (await RewardDistributorFactory.deploy(
			await creatorRegistry.getAddress(),
		)) as unknown as RewardDistributor;
		await rewardDistributor.waitForDeployment();

		await creatorRegistry
			.connect(creator1)
			.registerCreator("@creator1", PROFILE_HASH_1);
		await creatorRegistry
			.connect(creator2)
			.registerCreator("@creator2", PROFILE_HASH_2);
		await creatorRegistry
			.connect(creator3)
			.registerCreator("@creator3", PROFILE_HASH_3);
	});

	describe("Deployment", () => {
		it("Should set the correct creator registry address", async () => {
			expect(await rewardDistributor.creatorRegistry()).to.equal(
				await creatorRegistry.getAddress(),
			);
		});

		it("Should set the correct owner", async () => {
			expect(await rewardDistributor.owner()).to.equal(owner.address);
		});

		it("Should start with zero balance", async () => {
			expect(await rewardDistributor.getContractBalance()).to.equal(0);
		});

		it("Should reject deployment with zero address", async () => {
			const RewardDistributorFactory =
				await ethers.getContractFactory("RewardDistributor");
			await expect(
				RewardDistributorFactory.deploy(ethers.ZeroAddress),
			).to.be.revertedWith("Invalid registry address");
		});
	});

	describe("Funding", () => {
		it("Should accept BNB deposits via receive function", async () => {
			const depositAmount = ethers.parseEther("10");

			const tx = await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: depositAmount,
			});

			await expect(tx)
				.to.emit(rewardDistributor, "FundsDeposited")
				.withArgs(
					owner.address,
					depositAmount,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			expect(await rewardDistributor.getContractBalance()).to.equal(
				depositAmount,
			);
		});

		it("Should allow multiple deposits", async () => {
			const deposit1 = ethers.parseEther("5");
			const deposit2 = ethers.parseEther("3");

			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: deposit1,
			});

			await creator1.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: deposit2,
			});

			expect(await rewardDistributor.getContractBalance()).to.equal(
				deposit1 + deposit2,
			);
		});
	});

	describe("Epoch Creation", () => {
		it("Should create epoch successfully", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			const startTime = currentTime + 3600;
			const endTime = startTime + 86400;

			const tx = await rewardDistributor
				.connect(owner)
				.createEpoch(startTime, endTime);

			await expect(tx)
				.to.emit(rewardDistributor, "EpochCreated")
				.withArgs(
					1,
					startTime,
					endTime,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const epoch = await rewardDistributor.getEpoch(1);
			expect(epoch.id).to.equal(1);
			expect(epoch.startTime).to.equal(startTime);
			expect(epoch.endTime).to.equal(endTime);
			expect(epoch.totalRewards).to.equal(0);
			expect(epoch.distributed).to.equal(false);
		});

		it("Should increment epoch IDs correctly", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;

			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 3600, currentTime + 7200);
			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 10800, currentTime + 14400);

			const epoch2 = await rewardDistributor.getEpoch(2);
			expect(epoch2.id).to.equal(2);
		});

		it("Should reject epoch creation by non-owner", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;

			await expect(
				rewardDistributor
					.connect(creator1)
					.createEpoch(currentTime + 3600, currentTime + 7200),
			).to.be.revertedWithCustomError(
				rewardDistributor,
				"OwnableUnauthorizedAccount",
			);
		});

		it("Should reject invalid time range", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;

			await expect(
				rewardDistributor
					.connect(owner)
					.createEpoch(currentTime + 7200, currentTime + 3600),
			).to.be.revertedWith("Invalid time range");
		});

		it("Should reject past start time", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;

			await expect(
				rewardDistributor
					.connect(owner)
					.createEpoch(currentTime - 3600, currentTime + 3600),
			).to.be.revertedWith("Start time must be in future");
		});
	});

	describe("Reward Distribution", () => {
		let epochId: number;
		let currentTime: number;

		beforeEach(async () => {
			currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			const startTime = currentTime + 100;
			const endTime = startTime + 1000;

			const tx = await rewardDistributor
				.connect(owner)
				.createEpoch(startTime, endTime);
			const receipt = await tx.wait();
			epochId = 1;

			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: ethers.parseEther("100"),
			});

			await ethers.provider.send("evm_increaseTime", [1200]);
			await ethers.provider.send("evm_mine", []);
		});

		it("Should distribute rewards successfully", async () => {
			const creatorIds = [1, 2, 3];
			const amounts = [
				ethers.parseEther("10"),
				ethers.parseEther("20"),
				ethers.parseEther("15"),
			];

			const tx = await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);

			await expect(tx)
				.to.emit(rewardDistributor, "RewardsDistributed")
				.withArgs(
					epochId,
					creatorIds,
					amounts,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const epoch = await rewardDistributor.getEpoch(epochId);
			expect(epoch.distributed).to.equal(true);
			expect(epoch.totalRewards).to.equal(amounts[0] + amounts[1] + amounts[2]);

			const reward1 = await rewardDistributor.getReward(epochId, 1);
			expect(reward1.amount).to.equal(amounts[0]);
			expect(reward1.claimed).to.equal(false);
		});

		it("Should track pending withdrawals correctly", async () => {
			const creatorIds = [1, 2];
			const amounts = [ethers.parseEther("10"), ethers.parseEther("20")];

			await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);

			expect(
				await rewardDistributor.getPendingWithdrawal(creator1.address),
			).to.equal(amounts[0]);
			expect(
				await rewardDistributor.getPendingWithdrawal(creator2.address),
			).to.equal(amounts[1]);
		});

		it("Should reject distribution by non-owner", async () => {
			const creatorIds = [1];
			const amounts = [ethers.parseEther("10")];

			await expect(
				rewardDistributor
					.connect(creator1)
					.distributeRewards(epochId, creatorIds, amounts),
			).to.be.revertedWithCustomError(
				rewardDistributor,
				"OwnableUnauthorizedAccount",
			);
		});

		it("Should reject distribution for invalid epoch", async () => {
			const creatorIds = [1];
			const amounts = [ethers.parseEther("10")];

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(999, creatorIds, amounts),
			).to.be.revertedWith("Invalid epoch ID");
		});

		it("Should reject array length mismatch", async () => {
			const creatorIds = [1, 2];
			const amounts = [ethers.parseEther("10")];

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(epochId, creatorIds, amounts),
			).to.be.revertedWith("Array length mismatch");
		});

		it("Should reject empty arrays", async () => {
			await expect(
				rewardDistributor.connect(owner).distributeRewards(epochId, [], []),
			).to.be.revertedWith("Empty arrays");
		});

		it("Should reject duplicate distribution", async () => {
			const creatorIds = [1];
			const amounts = [ethers.parseEther("10")];

			await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(epochId, creatorIds, amounts),
			).to.be.revertedWith("Rewards already distributed");
		});

		it("Should reject distribution before epoch ends", async () => {
			// Get current block time after previous tests
			const latestBlock = await ethers.provider.getBlock("latest");
			const newCurrentTime = latestBlock!.timestamp;

			const tx = await rewardDistributor
				.connect(owner)
				.createEpoch(newCurrentTime + 1000, newCurrentTime + 5000);
			const receipt = await tx.wait();
			const newEpochId = 2; // Second epoch created

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(newEpochId, [1], [ethers.parseEther("10")]),
			).to.be.revertedWith("Epoch not ended yet");
		});

		it("Should reject distribution with insufficient balance", async () => {
			const creatorIds = [1];
			const amounts = [ethers.parseEther("200")];

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(epochId, creatorIds, amounts),
			).to.be.revertedWith("Insufficient contract balance");
		});

		it("Should reject zero amount", async () => {
			const creatorIds = [1];
			const amounts = [0];

			await expect(
				rewardDistributor
					.connect(owner)
					.distributeRewards(epochId, creatorIds, amounts),
			).to.be.revertedWith("Amount must be greater than 0");
		});
	});

	describe("Reward Claiming", () => {
		let epochId: number;

		beforeEach(async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			const startTime = currentTime + 100;
			const endTime = startTime + 1000;

			await rewardDistributor.connect(owner).createEpoch(startTime, endTime);
			epochId = 1;

			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: ethers.parseEther("100"),
			});

			await ethers.provider.send("evm_increaseTime", [1200]);
			await ethers.provider.send("evm_mine", []);

			const creatorIds = [1, 2];
			const amounts = [ethers.parseEther("10"), ethers.parseEther("15")];
			await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);
		});

		it("Should claim reward successfully", async () => {
			const rewardAmount = ethers.parseEther("10");
			const balanceBefore = await ethers.provider.getBalance(creator1.address);

			const tx = await rewardDistributor.connect(creator1).claimReward(epochId);
			const receipt = await tx.wait();
			const gasUsedBigInt = receipt!.gasUsed * receipt!.gasPrice;

			await expect(tx)
				.to.emit(rewardDistributor, "RewardClaimed")
				.withArgs(
					epochId,
					1,
					creator1.address,
					rewardAmount,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const balanceAfter = await ethers.provider.getBalance(creator1.address);
			expect(balanceAfter).to.equal(
				balanceBefore + rewardAmount - gasUsedBigInt,
			);

			const reward = await rewardDistributor.getReward(epochId, 1);
			expect(reward.claimed).to.equal(true);
			expect(
				await rewardDistributor.getPendingWithdrawal(creator1.address),
			).to.equal(0);
		});

		it("Should reject claim before distribution", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 100, currentTime + 1100);

			await expect(
				rewardDistributor.connect(creator1).claimReward(2),
			).to.be.revertedWith("Rewards not distributed yet");
		});

		it("Should reject duplicate claims", async () => {
			await rewardDistributor.connect(creator1).claimReward(epochId);

			await expect(
				rewardDistributor.connect(creator1).claimReward(epochId),
			).to.be.revertedWith("Reward already claimed");
		});

		it("Should reject claim by non-registered creator", async () => {
			await expect(
				rewardDistributor.connect(owner).claimReward(epochId),
			).to.be.revertedWith("No reward for this creator in this epoch");
		});

		it("Should reject claim for invalid epoch", async () => {
			await expect(
				rewardDistributor.connect(creator1).claimReward(999),
			).to.be.revertedWith("Invalid epoch ID");
		});
	});

	describe("Owner Functions", () => {
		beforeEach(async () => {
			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: ethers.parseEther("50"),
			});
		});

		it("Should allow owner to withdraw excess funds", async () => {
			const withdrawAmount = ethers.parseEther("10");
			const balanceBefore = await ethers.provider.getBalance(owner.address);

			const tx = await rewardDistributor
				.connect(owner)
				.withdrawExcess(withdrawAmount);
			const receipt = await tx.wait();
			const gasUsedBigInt = receipt!.gasUsed * receipt!.gasPrice;

			const balanceAfter = await ethers.provider.getBalance(owner.address);
			expect(balanceAfter).to.equal(
				balanceBefore + withdrawAmount - gasUsedBigInt,
			);
		});

		it("Should reject withdrawal by non-owner", async () => {
			await expect(
				rewardDistributor
					.connect(creator1)
					.withdrawExcess(ethers.parseEther("10")),
			).to.be.revertedWithCustomError(
				rewardDistributor,
				"OwnableUnauthorizedAccount",
			);
		});

		it("Should reject withdrawal exceeding balance", async () => {
			await expect(
				rewardDistributor
					.connect(owner)
					.withdrawExcess(ethers.parseEther("100")),
			).to.be.revertedWith("Insufficient balance");
		});
	});

	describe("View Functions", () => {
		let epochId: number;

		beforeEach(async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 100, currentTime + 1100);
			epochId = 1;

			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: ethers.parseEther("100"),
			});

			await ethers.provider.send("evm_increaseTime", [1200]);
			await ethers.provider.send("evm_mine", []);

			const creatorIds = [1, 2, 3];
			const amounts = [
				ethers.parseEther("10"),
				ethers.parseEther("15"),
				ethers.parseEther("20"),
			];
			await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);
		});

		it("Should get epoch details", async () => {
			const epoch = await rewardDistributor.getEpoch(epochId);
			expect(epoch.distributed).to.equal(true);
			expect(epoch.totalRewards).to.equal(ethers.parseEther("45"));
		});

		it("Should get reward details", async () => {
			const reward = await rewardDistributor.getReward(epochId, 2);
			expect(reward.amount).to.equal(ethers.parseEther("15"));
			expect(reward.claimed).to.equal(false);
		});

		it("Should get epoch creators", async () => {
			const creators = await rewardDistributor.getEpochCreators(epochId);
			expect(creators.length).to.equal(3);
			expect(creators[0]).to.equal(1);
			expect(creators[1]).to.equal(2);
			expect(creators[2]).to.equal(3);
		});

		it("Should get contract balance", async () => {
			expect(await rewardDistributor.getContractBalance()).to.be.gte(
				ethers.parseEther("45"),
			);
		});

		it("Should reject getting invalid epoch", async () => {
			await expect(rewardDistributor.getEpoch(999)).to.be.revertedWith(
				"Invalid epoch ID",
			);
		});
	});

	describe("Reentrancy Protection", () => {
		let epochId: number;

		beforeEach(async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 100, currentTime + 1100);
			epochId = 1;

			await owner.sendTransaction({
				to: await rewardDistributor.getAddress(),
				value: ethers.parseEther("100"),
			});

			await ethers.provider.send("evm_increaseTime", [1200]);
			await ethers.provider.send("evm_mine", []);

			const creatorIds = [1];
			const amounts = [ethers.parseEther("10")];
			await rewardDistributor
				.connect(owner)
				.distributeRewards(epochId, creatorIds, amounts);
		});

		it("Should protect distributeRewards from reentrancy", async () => {
			const currentTime = (await ethers.provider.getBlock("latest"))!.timestamp;
			await rewardDistributor
				.connect(owner)
				.createEpoch(currentTime + 100, currentTime + 1100);
			await ethers.provider.send("evm_increaseTime", [1200]);
			await ethers.provider.send("evm_mine", []);

			const tx = rewardDistributor
				.connect(owner)
				.distributeRewards(2, [2], [ethers.parseEther("10")]);
			await expect(tx).to.not.be.reverted;
		});

		it("Should protect claimReward from reentrancy", async () => {
			const tx = rewardDistributor.connect(creator1).claimReward(epochId);
			await expect(tx).to.not.be.reverted;
		});

		it("Should protect withdrawExcess from reentrancy", async () => {
			const tx = rewardDistributor
				.connect(owner)
				.withdrawExcess(ethers.parseEther("10"));
			await expect(tx).to.not.be.reverted;
		});
	});
});
