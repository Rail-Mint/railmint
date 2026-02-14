const { ethers } = require("hardhat");

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log("Deploying contracts with account:", deployer.address);
	console.log(
		"Account balance:",
		ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
	);

	// Deploy CreatorRegistry
	console.log("\n1. Deploying CreatorRegistry...");
	const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
	const creatorRegistry = await CreatorRegistry.deploy();
	await creatorRegistry.waitForDeployment();
	const creatorRegistryAddress = await creatorRegistry.getAddress();
	console.log("CreatorRegistry deployed to:", creatorRegistryAddress);

	// Deploy ContentManager
	console.log("\n2. Deploying ContentManager...");
	const ContentManager = await ethers.getContractFactory("ContentManager");
	const contentManager = await ContentManager.deploy(creatorRegistryAddress);
	await contentManager.waitForDeployment();
	const contentManagerAddress = await contentManager.getAddress();
	console.log("ContentManager deployed to:", contentManagerAddress);

	// Deploy RewardDistributor
	console.log("\n3. Deploying RewardDistributor...");
	const RewardDistributor =
		await ethers.getContractFactory("RewardDistributor");
	const rewardDistributor = await RewardDistributor.deploy(
		creatorRegistryAddress,
	);
	await rewardDistributor.waitForDeployment();
	const rewardDistributorAddress = await rewardDistributor.getAddress();
	console.log("RewardDistributor deployed to:", rewardDistributorAddress);

	console.log("\n========================================");
	console.log("Deployment Complete!");
	console.log("========================================");
	console.log("\nAdd these addresses to your .env file:");
	console.log(`VITE_CREATOR_REGISTRY_ADDRESS=${creatorRegistryAddress}`);
	console.log(`VITE_CONTENT_MANAGER_ADDRESS=${contentManagerAddress}`);
	console.log(`VITE_REWARD_DISTRIBUTOR_ADDRESS=${rewardDistributorAddress}`);

	console.log("\nNetwork:", (await ethers.provider.getNetwork()).name);
	console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);

	console.log("\nVerify contracts on block explorer:");
	console.log(
		`npx hardhat verify --network bscTestnet ${creatorRegistryAddress}`,
	);
	console.log(
		`npx hardhat verify --network bscTestnet ${contentManagerAddress} ${creatorRegistryAddress}`,
	);
	console.log(
		`npx hardhat verify --network bscTestnet ${rewardDistributorAddress} ${creatorRegistryAddress}`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
