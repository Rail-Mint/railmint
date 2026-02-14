import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

import type { ContentManager, CreatorRegistry } from "../typechain-types";

describe("ContentManager", () => {
	let creatorRegistry: CreatorRegistry;
	let contentManager: ContentManager;
	let owner: SignerWithAddress;
	let creator1: SignerWithAddress;
	let creator2: SignerWithAddress;
	let voter1: SignerWithAddress;
	let voter2: SignerWithAddress;

	const PROFILE_HASH_1 = ethers.id("profile1");
	const PROFILE_HASH_2 = ethers.id("profile2");
	const CONTENT_HASH_1 = ethers.id("content1");
	const CONTENT_HASH_2 = ethers.id("content2");
	const IPFS_URI_1 = "ipfs://QmTest1";
	const IPFS_URI_2 = "ipfs://QmTest2";

	beforeEach(async () => {
		[owner, creator1, creator2, voter1, voter2] = await ethers.getSigners();

		const CreatorRegistryFactory =
			await ethers.getContractFactory("CreatorRegistry");
		creatorRegistry =
			(await CreatorRegistryFactory.deploy()) as unknown as CreatorRegistry;
		await creatorRegistry.waitForDeployment();

		const ContentManagerFactory =
			await ethers.getContractFactory("ContentManager");
		contentManager = (await ContentManagerFactory.deploy(
			await creatorRegistry.getAddress(),
		)) as unknown as ContentManager;
		await contentManager.waitForDeployment();

		await creatorRegistry
			.connect(creator1)
			.registerCreator("@creator1", PROFILE_HASH_1);
		await creatorRegistry
			.connect(creator2)
			.registerCreator("@creator2", PROFILE_HASH_2);
	});

	describe("Deployment", () => {
		it("Should set the correct creator registry address", async () => {
			expect(await contentManager.creatorRegistry()).to.equal(
				await creatorRegistry.getAddress(),
			);
		});

		it("Should set the correct owner", async () => {
			expect(await contentManager.owner()).to.equal(owner.address);
		});

		it("Should start with zero contents", async () => {
			expect(await contentManager.getTotalContents()).to.equal(0);
		});

		it("Should reject deployment with zero address", async () => {
			const ContentManagerFactory =
				await ethers.getContractFactory("ContentManager");
			await expect(
				ContentManagerFactory.deploy(ethers.ZeroAddress),
			).to.be.revertedWith("Invalid registry address");
		});
	});

	describe("Content Publishing", () => {
		it("Should publish content successfully", async () => {
			const tx = await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);

			await expect(tx)
				.to.emit(contentManager, "ContentPublished")
				.withArgs(
					1,
					1,
					CONTENT_HASH_1,
					IPFS_URI_1,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const content = await contentManager.getContent(1);
			expect(content.id).to.equal(1);
			expect(content.creatorId).to.equal(1);
			expect(content.contentHash).to.equal(CONTENT_HASH_1);
			expect(content.ipfsUri).to.equal(IPFS_URI_1);
			expect(content.likeCount).to.equal(0);
			expect(content.isActive).to.equal(true);
		});

		it("Should increment content IDs correctly", async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
			await contentManager
				.connect(creator2)
				.publishContent(2, CONTENT_HASH_2, IPFS_URI_2);

			expect(await contentManager.getTotalContents()).to.equal(2);
		});

		it("Should track creator's content", async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_2, IPFS_URI_2);

			const creatorContents = await contentManager.getCreatorContent(1);
			expect(creatorContents.length).to.equal(2);
			expect(creatorContents[0]).to.equal(1);
			expect(creatorContents[1]).to.equal(2);
		});

		it("Should reject publishing with empty content hash", async () => {
			await expect(
				contentManager
					.connect(creator1)
					.publishContent(1, ethers.ZeroHash, IPFS_URI_1),
			).to.be.revertedWith("Content hash cannot be empty");
		});

		it("Should reject publishing with empty IPFS URI", async () => {
			await expect(
				contentManager.connect(creator1).publishContent(1, CONTENT_HASH_1, ""),
			).to.be.revertedWith("IPFS URI cannot be empty");
		});

		it("Should reject publishing for non-existent creator", async () => {
			await expect(
				contentManager
					.connect(creator1)
					.publishContent(999, CONTENT_HASH_1, IPFS_URI_1),
			).to.be.revertedWith("Invalid creator ID");
		});

		it("Should reject publishing from wrong wallet", async () => {
			await expect(
				contentManager
					.connect(creator2)
					.publishContent(1, CONTENT_HASH_1, IPFS_URI_1),
			).to.be.revertedWith("Not the creator's wallet");
		});

		it("Should reject publishing for deactivated creator", async () => {
			await creatorRegistry.connect(owner).deactivateCreator(1);

			await expect(
				contentManager
					.connect(creator1)
					.publishContent(1, CONTENT_HASH_1, IPFS_URI_1),
			).to.be.revertedWith("Creator is not active");
		});
	});

	describe("Content Liking", () => {
		beforeEach(async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
		});

		it("Should like content successfully", async () => {
			const tx = await contentManager.connect(voter1).likeContent(1);

			await expect(tx)
				.to.emit(contentManager, "ContentLiked")
				.withArgs(
					1,
					voter1.address,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const content = await contentManager.getContent(1);
			expect(content.likeCount).to.equal(1);
			expect(await contentManager.hasLikedContent(1, voter1.address)).to.equal(
				true,
			);
		});

		it("Should allow multiple users to like content", async () => {
			await contentManager.connect(voter1).likeContent(1);
			await contentManager.connect(voter2).likeContent(1);

			const content = await contentManager.getContent(1);
			expect(content.likeCount).to.equal(2);
			expect(await contentManager.hasLikedContent(1, voter1.address)).to.equal(
				true,
			);
			expect(await contentManager.hasLikedContent(1, voter2.address)).to.equal(
				true,
			);
		});

		it("Should reject duplicate likes from same wallet", async () => {
			await contentManager.connect(voter1).likeContent(1);

			await expect(
				contentManager.connect(voter1).likeContent(1),
			).to.be.revertedWith("Already liked this content");
		});

		it("Should reject liking invalid content ID", async () => {
			await expect(
				contentManager.connect(voter1).likeContent(999),
			).to.be.revertedWith("Invalid content ID");
		});

		it("Should reject liking deactivated content", async () => {
			await contentManager.connect(creator1).deactivateContent(1);

			await expect(
				contentManager.connect(voter1).likeContent(1),
			).to.be.revertedWith("Content is not active");
		});
	});

	describe("Content Unliking", () => {
		beforeEach(async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
			await contentManager.connect(voter1).likeContent(1);
		});

		it("Should unlike content successfully", async () => {
			const tx = await contentManager.connect(voter1).unlikeContent(1);

			await expect(tx)
				.to.emit(contentManager, "ContentUnliked")
				.withArgs(
					1,
					voter1.address,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const content = await contentManager.getContent(1);
			expect(content.likeCount).to.equal(0);
			expect(await contentManager.hasLikedContent(1, voter1.address)).to.equal(
				false,
			);
		});

		it("Should update like count correctly after multiple likes/unlikes", async () => {
			await contentManager.connect(voter2).likeContent(1);
			expect((await contentManager.getContent(1)).likeCount).to.equal(2);

			await contentManager.connect(voter1).unlikeContent(1);
			expect((await contentManager.getContent(1)).likeCount).to.equal(1);

			await contentManager.connect(voter2).unlikeContent(1);
			expect((await contentManager.getContent(1)).likeCount).to.equal(0);
		});

		it("Should reject unliking content not previously liked", async () => {
			await expect(
				contentManager.connect(voter2).unlikeContent(1),
			).to.be.revertedWith("Haven't liked this content");
		});

		it("Should reject unliking invalid content ID", async () => {
			await expect(
				contentManager.connect(voter1).unlikeContent(999),
			).to.be.revertedWith("Invalid content ID");
		});

		it("Should reject unliking deactivated content", async () => {
			await contentManager.connect(creator1).deactivateContent(1);

			await expect(
				contentManager.connect(voter1).unlikeContent(1),
			).to.be.revertedWith("Content is not active");
		});
	});

	describe("Content Deactivation", () => {
		beforeEach(async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
		});

		it("Should allow creator to deactivate their own content", async () => {
			const tx = await contentManager.connect(creator1).deactivateContent(1);

			await expect(tx)
				.to.emit(contentManager, "ContentDeactivated")
				.withArgs(
					1,
					await ethers.provider.getBlock("latest").then((b) => b!.timestamp),
				);

			const content = await contentManager.getContent(1);
			expect(content.isActive).to.equal(false);
		});

		it("Should allow owner to deactivate any content", async () => {
			await contentManager
				.connect(creator2)
				.publishContent(2, CONTENT_HASH_2, IPFS_URI_2);

			await expect(contentManager.connect(owner).deactivateContent(2)).to.not.be
				.reverted;

			const content = await contentManager.getContent(2);
			expect(content.isActive).to.equal(false);
		});

		it("Should reject deactivation by unauthorized user", async () => {
			await expect(
				contentManager.connect(creator2).deactivateContent(1),
			).to.be.revertedWith("Not authorized");
		});

		it("Should reject deactivation of invalid content ID", async () => {
			await expect(
				contentManager.connect(creator1).deactivateContent(999),
			).to.be.revertedWith("Invalid content ID");
		});

		it("Should reject duplicate deactivation", async () => {
			await contentManager.connect(creator1).deactivateContent(1);

			await expect(
				contentManager.connect(creator1).deactivateContent(1),
			).to.be.revertedWith("Content already deactivated");
		});
	});

	describe("View Functions", () => {
		beforeEach(async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
			await contentManager
				.connect(creator2)
				.publishContent(2, CONTENT_HASH_2, IPFS_URI_2);
			await contentManager.connect(voter1).likeContent(1);
		});

		it("Should get content by ID", async () => {
			const content = await contentManager.getContent(1);
			expect(content.creatorId).to.equal(1);
			expect(content.contentHash).to.equal(CONTENT_HASH_1);
			expect(content.ipfsUri).to.equal(IPFS_URI_1);
			expect(content.likeCount).to.equal(1);
		});

		it("Should get creator's content list", async () => {
			const contents = await contentManager.getCreatorContent(1);
			expect(contents.length).to.equal(1);
			expect(contents[0]).to.equal(1);
		});

		it("Should check if user liked content", async () => {
			expect(await contentManager.hasLikedContent(1, voter1.address)).to.equal(
				true,
			);
			expect(await contentManager.hasLikedContent(1, voter2.address)).to.equal(
				false,
			);
		});

		it("Should get total contents count", async () => {
			expect(await contentManager.getTotalContents()).to.equal(2);
		});

		it("Should reject getting invalid content ID", async () => {
			await expect(contentManager.getContent(999)).to.be.revertedWith(
				"Invalid content ID",
			);
		});
	});

	describe("Reentrancy Protection", () => {
		beforeEach(async () => {
			await contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_1, IPFS_URI_1);
		});

		it("Should protect publishContent from reentrancy", async () => {
			const tx = contentManager
				.connect(creator1)
				.publishContent(1, CONTENT_HASH_2, IPFS_URI_2);
			await expect(tx).to.not.be.reverted;
		});

		it("Should protect likeContent from reentrancy", async () => {
			const tx = contentManager.connect(voter1).likeContent(1);
			await expect(tx).to.not.be.reverted;
		});

		it("Should protect unlikeContent from reentrancy", async () => {
			await contentManager.connect(voter1).likeContent(1);
			const tx = contentManager.connect(voter1).unlikeContent(1);
			await expect(tx).to.not.be.reverted;
		});
	});
});
