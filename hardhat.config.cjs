require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv/config");

const bscTestnetRpcUrl = process.env.BSC_TESTNET_RPC_URL;

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
	solidity: {
		version: "0.8.20",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	networks: {
		hardhat: {
			chainId: 31337,
		},
		...(bscTestnetRpcUrl
			? {
					bscTestnet: {
						url: bscTestnetRpcUrl,
						chainId: 97,
						accounts: process.env.TESTNET_PRIVATE_KEY
							? [process.env.TESTNET_PRIVATE_KEY]
							: [],
						gasPrice: 10000000000,
					},
				}
			: {}),
	},
	etherscan: {
		apiKey: {
			bscTestnet: process.env.BSC_SCAN_API_KEY || "",
		},
	},
	paths: {
		sources: "./contracts",
		tests: "./test",
		cache: "./cache",
		artifacts: "./artifacts",
	},
	typechain: {
		outDir: "typechain-types",
		target: "ethers-v6",
	},
	mocha: {
		timeout: 40000,
		require: ["ts-node/register/transpile-only"],
	},
	"ts-node": {
		transpileOnly: true,
		compilerOptions: {
			module: "commonjs",
			esModuleInterop: true,
		},
	},
};

module.exports = config;
