require('dotenv').config();
console.log("ENV VARIABLES LOADED:", process.env.RPC_URL_ETHEREUM);
const { ethers } = require("ethers");
console.log("Ethers module loaded:", ethers);

class SystemConfig {
    constructor() {
        // Supported blockchain networks (with defaults for missing env variables)
        this.networks = {
            ETH: {
                name: "Ethereum",
                rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/default",  // fallback URL
                feeWallet: process.env.FEE_WALLET_ETH || "0x0000000000000000000000000000000000000000", // Default address
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
                rpcUrl: process.env.RPC_URL_DAG || "https://constellationnetwork.io.s3-website.us-west-1.amazonaws.com/currency/v1/l1/public/", // Check if this needs to be updated from env
                feeWallet: process.env.FEE_WALLET_DAG || "DAG5JL23TzANyohk1enp6VgdBoEBeYFNPpGQiSK2",
            },
        };

        // MongoDB config from environment
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/hyprmtrx",  // Local fallback
            dbName: process.env.MONGO_DB_NAME || "hyprmtrx",  // Default DB name if not set
        };
        
        // Initialize providers for each network
        this.providers = this.initializeProviders();
    }

    /**
     * Initialize blockchain providers using configured RPC URLs.
     * @returns {Object} - Providers keyed by network.
     */
    initializeProviders() {
    const providers = {};
    for (const [key, config] of Object.entries(this.networks)) {
        console.log(`Network: ${key}, RPC URL: ${config.rpcUrl}`);
        if (!config.rpcUrl) {
            console.error(`RPC URL missing for network: ${key}`);
        }
        providers[key] = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    }
    return providers;
}


    /**
     * Get configuration for a specific network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {Object} - Network configuration.
     */
    getNetworkConfig(network) {
        if (!this.networks[network]) {
            throw new Error(`Unsupported network: ${network}`);
        }
        return this.networks[network];
    }

    /**
     * Get the provider for a specific network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {Object} - ethers.js provider.
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
     * Get the list of all supported networks.
     * @returns {Array} - Array of network keys (e.g., ['ETH', 'BNB']).
     */
    getSupportedNetworks() {
        return Object.keys(this.networks);
    }

    /**
     * Validate if a network is supported.
     * @param {string} network - The network key to validate.
     * @returns {boolean} - True if supported, false otherwise.
     */
    isNetworkSupported(network) {
        return this.networks.hasOwnProperty(network);
    }
}

module.exports = SystemConfig;
