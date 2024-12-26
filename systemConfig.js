// Log loaded environment variables for debugging
console.log("Loaded Environment Variables:", {
    RPC_URL_ETHEREUM: process.env.RPC_URL_ETHEREUM,
    RPC_URL_BNB: process.env.RPC_URL_BNB,
    RPC_URL_AVAX: process.env.RPC_URL_AVAX,
    RPC_URL_BASE: process.env.RPC_URL_BASE,
    RPC_URL_DAG: process.env.RPC_URL_DAG,
    MONGO_URI: process.env.MONGO_URI,
    MONGO_DB_NAME: process.env.MONGO_DB_NAME,
});

import { JsonRpcProvider } from "ethers"; // Import only JsonRpcProvider
console.log("Testing JsonRpcProvider import:", JsonRpcProvider);

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

        // MongoDB config from environment
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/hyprmtrx",
            dbName: process.env.MONGO_DB_NAME || "hyprmtrx",
        };

        // Validate Mongo URI
        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        // Initialize providers for each network
        this.providers = this.initializeProviders();
    }

    initializeProviders() {
        const providers = {};
        for (const [key, config] of Object.entries(this.networks)) {
            console.log(`Network: ${key}, RPC URL: ${config.rpcUrl}`);
            if (!config.rpcUrl) {
                console.error(`RPC URL missing or invalid for network: ${key}`);
                continue;
            }
            try {
                const provider = new JsonRpcProvider(config.rpcUrl);
                providers[key] = provider;
                console.log(`Provider for ${key} initialized:`, provider);
            } catch (error) {
                console.error(`Failed to initialize provider for ${key}:`, error.message);
            }
        }
        return providers;
    }

    get mongoUrl() {
        return this.mongoConfig.uri;
    }

    get dbName() {
        return this.mongoConfig.dbName;
    }

    getNetworkConfig(network) {
        console.log(`Fetching config for network: ${network}`);
        if (!this.networks[network]) {
            throw new Error(`Unsupported network: ${network}`);
        }
        return this.networks[network];
    }

    getProvider(network) {
        const provider = this.providers[network];
        if (!provider) {
            throw new Error(`Provider not found for network: ${network}`);
        }
        return provider;
    }

    getFeeWallet(network) {
        const config = this.getNetworkConfig(network);
        return config.feeWallet;
    }

    getSupportedNetworks() {
        return Object.keys(this.networks);
    }

    isNetworkSupported(network) {
        return this.networks.hasOwnProperty(network);
    }
}

export default SystemConfig;
