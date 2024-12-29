import 'dotenv/config'; // Load environment variables from .env file
import { JsonRpcProvider } from "ethers";

class SystemConfig {
    constructor() {
        // MongoDB configuration with fallback values
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/default_db",
            dbName: process.env.MONGO_DB_NAME || "default_db",
        };

        // Debug: Log MongoDB configuration
        console.log("SystemConfig Mongo URI:", this.mongoConfig.uri);
        console.log("SystemConfig Mongo DB Name:", this.mongoConfig.dbName);

        // Validate Mongo URI
        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        // Supported blockchain networks configuration
        this.networks = {
            ETH: {
                name: "Ethereum",
                rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/default",
                feeWallet: process.env.FEE_WALLET_ETH || "0x0000000000000000000000000000000000000000",
            },
            BNB: {
                name: "Binance Smart Chain",
                rpcUrl: process.env.RPC_URL_BNB || "https://bsc-dataseed.binance.org/",
                feeWallet: process.env.FEE_WALLET_BNB || "0x0000000000000000000000000000000000000000",
            },
            AVAX: {
                name: "Avalanche",
                rpcUrl: process.env.RPC_URL_AVAX || "https://api.avax.network/ext/bc/C/rpc",
                feeWallet: process.env.FEE_WALLET_AVAX || "0x0000000000000000000000000000000000000000",
            },
            Base: {
                name: "Base",
                rpcUrl: process.env.RPC_URL_BASE || "https://base-rpc-url.com",
                feeWallet: process.env.FEE_WALLET_BASE || "0x0000000000000000000000000000000000000000",
            },
            DAG: {
                name: "Constellation",
                rpcUrl: process.env.RPC_URL_DAG || "https://constellationnetwork.io.s3-website.us-west-1.amazonaws.com/currency/v1/l1/public/",
                feeWallet: process.env.FEE_WALLET_DAG || "DAG5JL23TzANyohk1enp6VgdBoEBeYFNPpGQiSK2",
            },
        };

        // Debug: Log supported networks
        console.log("Supported Networks:", Object.keys(this.networks));

        // Initialize blockchain providers
        this.providers = this.initializeProviders();

        // Set Game API Base URL with fallback to the specified default
        this.gameApiBaseUrl = process.env.GAME_API_BASE_URL || "https://hyprmtrx.xyz/api/auth";
    }

    /**
     * Initialize blockchain providers for each network using RPC URLs.
     * @returns {Object} - Providers keyed by network name.
     */
    initializeProviders() {
        const providers = {};
        for (const [key, config] of Object.entries(this.networks)) {
            console.log(`Initializing provider for ${key} with RPC URL: ${config.rpcUrl}`);
            try {
                providers[key] = new JsonRpcProvider(config.rpcUrl);
                console.log(`Provider for ${key} initialized successfully.`);
            } catch (error) {
                console.error(`Failed to initialize provider for ${key}:`, error.message);
            }
        }
        return providers;
    }

    /**
     * Get the MongoDB connection URI.
     * @returns {string} - MongoDB URI.
     */
    getMongoUri() {
        return this.mongoConfig.uri;
    }

    /**
     * Get the MongoDB database name.
     * @returns {string} - MongoDB database name.
     */
    getMongoDbName() {
        return this.mongoConfig.dbName;
    }

    /**
     * Get configuration for a specific network.
     * @param {string} network - Network key (e.g., 'ETH', 'BNB').
     * @returns {Object} - Configuration for the specified network.
     */
    getNetworkConfig(network) {
        if (!this.networks[network]) {
            throw new Error(`Unsupported network: ${network}`);
        }
        return this.networks[network];
    }

    /**
     * Get the provider for a specific network.
     * @param {string} network - Network key (e.g., 'ETH', 'BNB').
     * @returns {JsonRpcProvider} - Provider instance for the specified network.
     */
    getProvider(network) {
        const provider = this.providers[network];
        if (!provider) {
            throw new Error(`Provider not found for network: ${network}`);
        }
        return provider;
    }

    /**
     * Get the fee wallet address for a specific network.
     * @param {string} network - Network key (e.g., 'ETH', 'BNB').
     * @returns {string} - Fee wallet address for the specified network.
     */
    getFeeWallet(network) {
        return this.getNetworkConfig(network).feeWallet;
    }

    /**
     * Get a list of all supported networks.
     * @returns {Array<string>} - List of supported network keys (e.g., ['ETH', 'BNB']).
     */
    getSupportedNetworks() {
        return Object.keys(this.networks);
    }

    /**
     * Check if a network is supported.
     * @param {string} network - Network key to validate.
     * @returns {boolean} - True if the network is supported, false otherwise.
     */
    isNetworkSupported(network) {
        return this.networks.hasOwnProperty(network);
    }

    /**
     * Get the base URL for the Game API.
     * @returns {string} - Game API base URL.
     */
    getGameAPIBaseUrl() {
        if (!this.gameApiBaseUrl.startsWith("http")) {
            throw new Error(`Invalid Game API Base URL: ${this.gameApiBaseUrl}`);
        }
        return this.gameApiBaseUrl;
    }
}

export default SystemConfig;
