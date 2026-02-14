import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  encodeDeployData,
} from "npm:viem@2.45.3";
import { privateKeyToAccount } from "npm:viem@2.45.3/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const opBNBTestnet = defineChain({
  id: 5611,
  name: "opBNB Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://opbnb-testnet-rpc.bnbchain.org"] },
  },
  blockExplorers: {
    default: { name: "opBNBScan", url: "https://testnet.opbnbscan.com" },
  },
  testnet: true,
});

// Pre-compiled bytecodes and ABIs for the 3 contracts
// These were compiled with solc 0.8.20, optimizer 200 runs, EVM target paris
// using OpenZeppelin Contracts v5.0.0

// We'll compile on-the-fly using solc
async function compileSolidity(sources: Record<string, string>) {
  // Fetch solc via dynamic import
  const solc = (await import("https://esm.sh/solc@0.8.28?bundle")).default;

  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(sources).map(([name, content]) => [name, { content }])
    ),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: any) => e.severity === "error")) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    throw new Error(`Compilation errors: ${JSON.stringify(errors.map((e: any) => e.message))}`);
  }

  return output;
}

async function fetchOZSource(path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v5.0.0/contracts/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const privateKey = Deno.env.get("BNB_TESTNET_PRIVATE_KEY");
    if (!privateKey) {
      return new Response(
        JSON.stringify({ error: "BNB_TESTNET_PRIVATE_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = privateKeyToAccount(
      (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
    );

    const publicClient = createPublicClient({
      chain: opBNBTestnet,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: opBNBTestnet,
      transport: http(),
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`Deployer: ${account.address}, Balance: ${balance} wei`);

    if (balance === 0n) {
      return new Response(
        JSON.stringify({ 
          error: "Deployer wallet has no tBNB. Fund it from the opBNB faucet.",
          deployer: account.address,
          faucet: "https://opbnb-testnet-bridge.bnbchain.org/deposit"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch OpenZeppelin sources
    console.log("Fetching OpenZeppelin sources...");
    const [ownableSrc, contextSrc, reentrancySrc] = await Promise.all([
      fetchOZSource("access/Ownable.sol"),
      fetchOZSource("utils/Context.sol"),
      fetchOZSource("utils/ReentrancyGuard.sol"),
    ]);

    // Read contract sources (inline them since we can't read files)
    const creatorRegistrySrc = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract CreatorRegistry is Ownable, ReentrancyGuard {
    struct Creator { uint256 id; address wallet; string xHandle; bytes32 profileHash; uint256 registeredAt; bool isActive; }
    uint256 private _creatorIdCounter;
    mapping(uint256 => Creator) public creators;
    mapping(address => uint256) public walletToCreatorId;
    mapping(string => bool) private xHandleExists;
    event CreatorRegistered(uint256 indexed creatorId, address indexed wallet, string xHandle, bytes32 profileHash, uint256 timestamp);
    event CreatorUpdated(uint256 indexed creatorId, bytes32 newProfileHash, uint256 timestamp);
    event CreatorDeactivated(uint256 indexed creatorId, uint256 timestamp);
    constructor() Ownable(msg.sender) { _creatorIdCounter = 1; }
    function registerCreator(string memory _xHandle, bytes32 _profileHash) external nonReentrant returns (uint256) {
        require(bytes(_xHandle).length > 0, "X handle cannot be empty");
        require(_profileHash != bytes32(0), "Profile hash cannot be empty");
        require(walletToCreatorId[msg.sender] == 0, "Creator already registered");
        require(!xHandleExists[_xHandle], "X handle already taken");
        uint256 creatorId = _creatorIdCounter++;
        creators[creatorId] = Creator({ id: creatorId, wallet: msg.sender, xHandle: _xHandle, profileHash: _profileHash, registeredAt: block.timestamp, isActive: true });
        walletToCreatorId[msg.sender] = creatorId;
        xHandleExists[_xHandle] = true;
        emit CreatorRegistered(creatorId, msg.sender, _xHandle, _profileHash, block.timestamp);
        return creatorId;
    }
    function updateProfile(bytes32 _profileHash) external nonReentrant {
        uint256 creatorId = walletToCreatorId[msg.sender];
        require(creatorId != 0, "Creator not registered");
        require(creators[creatorId].isActive, "Creator is deactivated");
        require(_profileHash != bytes32(0), "Profile hash cannot be empty");
        creators[creatorId].profileHash = _profileHash;
        emit CreatorUpdated(creatorId, _profileHash, block.timestamp);
    }
    function deactivateCreator(uint256 _creatorId) external onlyOwner {
        require(_creatorId > 0 && _creatorId < _creatorIdCounter, "Invalid creator ID");
        require(creators[_creatorId].isActive, "Creator already deactivated");
        creators[_creatorId].isActive = false;
        emit CreatorDeactivated(_creatorId, block.timestamp);
    }
    function getCreator(uint256 _creatorId) external view returns (Creator memory) {
        require(_creatorId > 0 && _creatorId < _creatorIdCounter, "Invalid creator ID");
        return creators[_creatorId];
    }
    function getCreatorIdByWallet(address _wallet) external view returns (uint256) { return walletToCreatorId[_wallet]; }
    function isXHandleAvailable(string memory _xHandle) external view returns (bool) { return !xHandleExists[_xHandle]; }
    function getTotalCreators() external view returns (uint256) { return _creatorIdCounter - 1; }
}`;

    const contentManagerSrc = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface ICreatorRegistry {
    struct Creator { uint256 id; address wallet; string xHandle; bytes32 profileHash; uint256 registeredAt; bool isActive; }
    function getCreator(uint256 _creatorId) external view returns (Creator memory);
}
contract ContentManager is Ownable, ReentrancyGuard {
    struct Content { uint256 id; uint256 creatorId; bytes32 contentHash; string ipfsUri; uint256 publishedAt; uint256 likeCount; bool isActive; }
    uint256 private _contentIdCounter;
    ICreatorRegistry public creatorRegistry;
    mapping(uint256 => Content) public contents;
    mapping(uint256 => mapping(address => bool)) public hasLiked;
    mapping(uint256 => uint256[]) public creatorContents;
    event ContentPublished(uint256 indexed contentId, uint256 indexed creatorId, bytes32 contentHash, string ipfsUri, uint256 timestamp);
    event ContentLiked(uint256 indexed contentId, address indexed voter, uint256 timestamp);
    event ContentUnliked(uint256 indexed contentId, address indexed voter, uint256 timestamp);
    event ContentDeactivated(uint256 indexed contentId, uint256 timestamp);
    constructor(address _creatorRegistry) Ownable(msg.sender) {
        require(_creatorRegistry != address(0), "Invalid registry address");
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        _contentIdCounter = 1;
    }
    function publishContent(uint256 _creatorId, bytes32 _contentHash, string memory _ipfsUri) external nonReentrant returns (uint256) {
        require(_contentHash != bytes32(0), "Content hash cannot be empty");
        require(bytes(_ipfsUri).length > 0, "IPFS URI cannot be empty");
        ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(_creatorId);
        require(creator.id != 0, "Invalid creator ID");
        require(creator.isActive, "Creator is not active");
        require(creator.wallet == msg.sender, "Not the creator's wallet");
        uint256 contentId = _contentIdCounter++;
        contents[contentId] = Content({ id: contentId, creatorId: _creatorId, contentHash: _contentHash, ipfsUri: _ipfsUri, publishedAt: block.timestamp, likeCount: 0, isActive: true });
        creatorContents[_creatorId].push(contentId);
        emit ContentPublished(contentId, _creatorId, _contentHash, _ipfsUri, block.timestamp);
        return contentId;
    }
    function likeContent(uint256 _contentId) external nonReentrant {
        require(_contentId > 0 && _contentId < _contentIdCounter, "Invalid content ID");
        require(contents[_contentId].isActive, "Content is not active");
        require(!hasLiked[_contentId][msg.sender], "Already liked this content");
        contents[_contentId].likeCount++;
        hasLiked[_contentId][msg.sender] = true;
        emit ContentLiked(_contentId, msg.sender, block.timestamp);
    }
    function unlikeContent(uint256 _contentId) external nonReentrant {
        require(_contentId > 0 && _contentId < _contentIdCounter, "Invalid content ID");
        require(contents[_contentId].isActive, "Content is not active");
        require(hasLiked[_contentId][msg.sender], "Haven't liked this content");
        contents[_contentId].likeCount--;
        hasLiked[_contentId][msg.sender] = false;
        emit ContentUnliked(_contentId, msg.sender, block.timestamp);
    }
    function deactivateContent(uint256 _contentId) external nonReentrant {
        require(_contentId > 0 && _contentId < _contentIdCounter, "Invalid content ID");
        require(contents[_contentId].isActive, "Content already deactivated");
        Content storage content = contents[_contentId];
        ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(content.creatorId);
        require(msg.sender == owner() || msg.sender == creator.wallet, "Not authorized");
        content.isActive = false;
        emit ContentDeactivated(_contentId, block.timestamp);
    }
    function getContent(uint256 _contentId) external view returns (Content memory) {
        require(_contentId > 0 && _contentId < _contentIdCounter, "Invalid content ID");
        return contents[_contentId];
    }
    function getCreatorContent(uint256 _creatorId) external view returns (uint256[] memory) { return creatorContents[_creatorId]; }
    function hasLikedContent(uint256 _contentId, address _voter) external view returns (bool) { return hasLiked[_contentId][_voter]; }
    function getTotalContents() external view returns (uint256) { return _contentIdCounter - 1; }
}`;

    const rewardDistributorSrc = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface ICreatorRegistry {
    struct Creator { uint256 id; address wallet; string xHandle; bytes32 profileHash; uint256 registeredAt; bool isActive; }
    function getCreator(uint256 _creatorId) external view returns (Creator memory);
}
contract RewardDistributor is Ownable, ReentrancyGuard {
    struct Epoch { uint256 id; uint256 startTime; uint256 endTime; uint256 totalRewards; bool distributed; uint256 distributedAt; }
    struct CreatorReward { uint256 epochId; uint256 creatorId; uint256 amount; bool claimed; uint256 claimedAt; }
    uint256 private _epochIdCounter;
    ICreatorRegistry public creatorRegistry;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(uint256 => CreatorReward)) public rewards;
    mapping(uint256 => uint256[]) public epochCreators;
    mapping(address => uint256) public pendingWithdrawals;
    event EpochCreated(uint256 indexed epochId, uint256 startTime, uint256 endTime, uint256 timestamp);
    event RewardsDistributed(uint256 indexed epochId, uint256[] creatorIds, uint256[] amounts, uint256 timestamp);
    event RewardClaimed(uint256 indexed epochId, uint256 indexed creatorId, address indexed wallet, uint256 amount, uint256 timestamp);
    event FundsDeposited(address indexed sender, uint256 amount, uint256 timestamp);
    constructor(address _creatorRegistry) Ownable(msg.sender) {
        require(_creatorRegistry != address(0), "Invalid registry address");
        creatorRegistry = ICreatorRegistry(_creatorRegistry);
        _epochIdCounter = 1;
    }
    receive() external payable { emit FundsDeposited(msg.sender, msg.value, block.timestamp); }
    function createEpoch(uint256 _startTime, uint256 _endTime) external onlyOwner returns (uint256) {
        require(_startTime < _endTime, "Invalid time range");
        require(_startTime >= block.timestamp, "Start time must be in future");
        uint256 epochId = _epochIdCounter++;
        epochs[epochId] = Epoch({ id: epochId, startTime: _startTime, endTime: _endTime, totalRewards: 0, distributed: false, distributedAt: 0 });
        emit EpochCreated(epochId, _startTime, _endTime, block.timestamp);
        return epochId;
    }
    function distributeRewards(uint256 _epochId, uint256[] memory _creatorIds, uint256[] memory _amounts) external onlyOwner nonReentrant {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
        require(_creatorIds.length == _amounts.length, "Array length mismatch");
        require(_creatorIds.length > 0, "Empty arrays");
        require(!epochs[_epochId].distributed, "Rewards already distributed");
        require(block.timestamp >= epochs[_epochId].endTime, "Epoch not ended yet");
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _creatorIds.length; i++) {
            uint256 creatorId = _creatorIds[i];
            uint256 amount = _amounts[i];
            require(amount > 0, "Amount must be greater than 0");
            ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(creatorId);
            require(creator.id != 0, "Creator not found");
            require(creator.isActive, "Creator is not active");
            rewards[_epochId][creatorId] = CreatorReward({ epochId: _epochId, creatorId: creatorId, amount: amount, claimed: false, claimedAt: 0 });
            pendingWithdrawals[creator.wallet] += amount;
            totalAmount += amount;
            epochCreators[_epochId].push(creatorId);
        }
        require(address(this).balance >= totalAmount, "Insufficient contract balance");
        epochs[_epochId].totalRewards = totalAmount;
        epochs[_epochId].distributed = true;
        epochs[_epochId].distributedAt = block.timestamp;
        emit RewardsDistributed(_epochId, _creatorIds, _amounts, block.timestamp);
    }
    function claimReward(uint256 _epochId) external nonReentrant {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
        require(epochs[_epochId].distributed, "Rewards not distributed yet");
        uint256[] memory creatorIds = epochCreators[_epochId];
        uint256 creatorId = 0;
        for (uint256 i = 0; i < creatorIds.length; i++) {
            ICreatorRegistry.Creator memory creator = creatorRegistry.getCreator(creatorIds[i]);
            if (creator.wallet == msg.sender) { creatorId = creatorIds[i]; break; }
        }
        require(creatorId != 0, "No reward for this creator in this epoch");
        CreatorReward storage reward = rewards[_epochId][creatorId];
        require(!reward.claimed, "Reward already claimed");
        require(reward.amount > 0, "No reward to claim");
        reward.claimed = true;
        reward.claimedAt = block.timestamp;
        uint256 amount = reward.amount;
        pendingWithdrawals[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        emit RewardClaimed(_epochId, creatorId, msg.sender, amount, block.timestamp);
    }
    function getEpoch(uint256 _epochId) external view returns (Epoch memory) {
        require(_epochId > 0 && _epochId < _epochIdCounter, "Invalid epoch ID");
        return epochs[_epochId];
    }
    function getReward(uint256 _epochId, uint256 _creatorId) external view returns (CreatorReward memory) { return rewards[_epochId][_creatorId]; }
    function getEpochCreators(uint256 _epochId) external view returns (uint256[] memory) { return epochCreators[_epochId]; }
    function getPendingWithdrawal(address _wallet) external view returns (uint256) { return pendingWithdrawals[_wallet]; }
    function getContractBalance() external view returns (uint256) { return address(this).balance; }
    function withdrawExcess(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
    }
}`;

    // Build sources map
    const sources: Record<string, string> = {
      "@openzeppelin/contracts/access/Ownable.sol": ownableSrc,
      "@openzeppelin/contracts/utils/Context.sol": contextSrc,
      "@openzeppelin/contracts/utils/ReentrancyGuard.sol": reentrancySrc,
      "contracts/CreatorRegistry.sol": creatorRegistrySrc,
      "contracts/ContentManager.sol": contentManagerSrc,
      "contracts/RewardDistributor.sol": rewardDistributorSrc,
    };

    console.log("Compiling contracts...");
    const compiled = await compileSolidity(sources);

    // Extract bytecodes
    const registryBytecode = `0x${compiled.contracts["contracts/CreatorRegistry.sol"].CreatorRegistry.evm.bytecode.object}`;
    const registryAbi = compiled.contracts["contracts/CreatorRegistry.sol"].CreatorRegistry.abi;
    
    const contentBytecode = `0x${compiled.contracts["contracts/ContentManager.sol"].ContentManager.evm.bytecode.object}`;
    const contentAbi = compiled.contracts["contracts/ContentManager.sol"].ContentManager.abi;
    
    const rewardBytecode = `0x${compiled.contracts["contracts/RewardDistributor.sol"].RewardDistributor.evm.bytecode.object}`;
    const rewardAbi = compiled.contracts["contracts/RewardDistributor.sol"].RewardDistributor.abi;

    // Deploy CreatorRegistry (no constructor args)
    console.log("Deploying CreatorRegistry...");
    const registryHash = await walletClient.deployContract({
      abi: registryAbi,
      bytecode: registryBytecode as `0x${string}`,
    });
    const registryReceipt = await publicClient.waitForTransactionReceipt({ hash: registryHash });
    const registryAddress = registryReceipt.contractAddress!;
    console.log(`CreatorRegistry deployed: ${registryAddress}`);

    // Deploy ContentManager (constructor: address _creatorRegistry)
    console.log("Deploying ContentManager...");
    const contentHash = await walletClient.deployContract({
      abi: contentAbi,
      bytecode: contentBytecode as `0x${string}`,
      args: [registryAddress],
    });
    const contentReceipt = await publicClient.waitForTransactionReceipt({ hash: contentHash });
    const contentAddress = contentReceipt.contractAddress!;
    console.log(`ContentManager deployed: ${contentAddress}`);

    // Deploy RewardDistributor (constructor: address _creatorRegistry)
    console.log("Deploying RewardDistributor...");
    const rewardHash = await walletClient.deployContract({
      abi: rewardAbi,
      bytecode: rewardBytecode as `0x${string}`,
      args: [registryAddress],
    });
    const rewardReceipt = await publicClient.waitForTransactionReceipt({ hash: rewardHash });
    const rewardAddress = rewardReceipt.contractAddress!;
    console.log(`RewardDistributor deployed: ${rewardAddress}`);

    const result = {
      success: true,
      deployer: account.address,
      network: "opBNB Testnet (Chain ID: 5611)",
      contracts: {
        CreatorRegistry: registryAddress,
        ContentManager: contentAddress,
        RewardDistributor: rewardAddress,
      },
      transactions: {
        CreatorRegistry: registryHash,
        ContentManager: contentHash,
        RewardDistributor: rewardHash,
      },
      env: {
        VITE_CREATOR_REGISTRY_ADDRESS: registryAddress,
        VITE_CONTENT_PUBLISHING_ADDRESS: contentAddress,
        VITE_REWARD_DISTRIBUTOR_ADDRESS: rewardAddress,
      },
    };

    console.log("Deployment complete!", JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Deployment error:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
