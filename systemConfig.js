import { JsonRpcProvider } from "ethers";
import 'dotenv/config'; // Load environment variables

// Debug: Log loaded environment variables
console.log("Loaded Environment Variables:", {
    RPC_URL_ETHEREUM: process.env.RPC_URL_ETHEREUM,
    RPC_URL_BNB: process.env.RPC_URL_BNB,
    RPC_URL_AVAX: process.env.RPC_URL_AVAX,
    RPC_URL_BASE: process.env.RPC_URL_BASE,
    RPC_URL_DAG: process.env.RPC_URL_DAG,
    MONGO_URI: process.env.MONGO_URI,
    MONGO_DB_NAME: process.env.MONGO_DB_NAME,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
});

class SystemConfig {
    constructor() {
        // Supported blockchain networks (with defaults for missing env variables)
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

        // MongoDB configuration from environment
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/admin", // Default Mongo URI
            dbName: process.env.MONGO_DB_NAME || "admin", // Default DB name
        };

        // Validate Mongo URI
        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        // Validate Encryption Key
        if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
            console.warn("ENCRYPTION_KEY is missing or invalid (not 64 characters). This may cause errors.");
        }

        // Initialize blockchain providers
        this.providers = this.initializeProviders();
    }

    /**
     * Initialize blockchain providers using configured RPC URLs.
     * @returns {Object} - Providers keyed by network.
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
     * @returns {string} - Database name.
     */
    getMongoDbName() {
        return this.mongoConfig.dbName;
    }

    /**
     * Get configuration for a specific network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {Object} - Network configuration.
     */
    getNetworkConfig(network) {
        console.log(`Fetching configuration for network: ${network}`);
        if (!this.networks[network]) {
            throw new Error(`Unsupported network: ${network}`);
        }
        return this.networks[network];
    }

    /**
     * Get the provider for a specific network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {JsonRpcProvider} - ethers.js provider instance.
     */
    getProvider(network) {
        const provider = this.providers[network];
        if (!provider) {
            throw new Error(`Provider not found for network: ${network}`);
        }
        return provider;
    }

    /**
     * Get the fee wallet for a specific network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {string} - Fee wallet address.
     */
    getFeeWallet(network) {
        const config = this.getNetworkConfig(network);
        return config.feeWallet;
    }

    /**
     * Get the list of all supported networks.
     * @returns {Array} - Array of network keys (e.g., ['ETH', 'BNB']).
     */
    getSupportedNetworks() {
        return Object.keys(this.networks);
    }

    /**
     * Validate if a network is supported.
     * @param {string} network - The network key to validate.
     * @returns {boolean} - True if the network is supported.
     */
    isNetworkSupported(network) {
        return this.networks.hasOwnProperty(network);
    }
}

export default SystemConfig;
