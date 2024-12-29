import 'dotenv/config'; // Load environment variables from .env file
import { JsonRpcProvider } from "ethers"; // Blockchain provider for RPC interactions
import fs from "fs"; // File system for managing configurations dynamically (if needed)
import path from "path"; // Path utilities for working with file paths
import { WalletKit } from "@reown/walletkit"; // WalletKit for WalletConnect-related functionality

class SystemConfig {
    constructor() {
        // MongoDB configuration
        this.mongoConfig = {
            uri: process.env.MONGO_URI || "mongodb://localhost:27017/default_db", // Placeholder URI
            dbName: process.env.MONGO_DB_NAME || "default_db", // Placeholder database name
        };

        // Debug: Log MongoDB configuration
        console.log("SystemConfig Mongo URI:", this.mongoConfig.uri);
        console.log("SystemConfig Mongo DB Name:", this.mongoConfig.dbName);

        // Validate Mongo URI
        if (!this.mongoConfig.uri.startsWith("mongodb")) {
            throw new Error(`Invalid MongoDB URI: ${this.mongoConfig.uri}`);
        }

        // WalletConnect configuration
        this.walletConnect = {
            projectId: process.env.WALLETCONNECT_PROJECT_ID || "your_walletconnect_project_id", // Placeholder WalletConnect Project ID
            chains: [
                {
                    id: 1, // Ethereum Mainnet
                    rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID", // Placeholder RPC URL
                },
            ],
            metadata: {
                name: "hyprmtrx",
                description: "WEB3 Authentication via HyperMatrix",
                url: "https://hyprmtrx.xyz",
                icons: ["https://hyprmtrx.xyz/favicon.png"],
            },
            qrCodeBaseUrl: process.env.QR_CODE_BASE_URL || "https://hyprmtrx.xyz/qr-codes", // Placeholder QR code base URL
        };

        // Blockchain networks configuration
        this.networks = {
            ETH: {
                name: "Ethereum",
                rpcUrl: process.env.RPC_URL_ETHEREUM || "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID", // Placeholder RPC URL
                feeWallet: process.env.FEE_WALLET_ETH || "0x0000000000000000000000000000000000000000", // Placeholder wallet address
            },
            BNB: {
                name: "Binance Smart Chain",
                rpcUrl: process.env.RPC_URL_BNB || "https://bsc-dataseed.binance.org/", // Placeholder RPC URL
                feeWallet: process.env.FEE_WALLET_BNB || "0x0000000000000000000000000000000000000000", // Placeholder wallet address
            },
        };

        // Debug: Log supported networks
        console.log("Supported Networks:", Object.keys(this.networks));

        // Initialize blockchain providers
        this.providers = this.initializeProviders();
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
     * Get the WalletConnect project ID.
     * @returns {string} - WalletConnect project ID.
     */
    getWalletConnectProjectId() {
        return this.walletConnect.projectId;
    }

    /**
     * Get configuration for WalletConnect.
     * @returns {Object} - WalletConnect configuration object.
     */
    getWalletConnectConfig() {
        return this.walletConnect;
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
}

export default SystemConfig;
