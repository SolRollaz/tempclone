import AuthValidator from "./AuthValidator.js";
import WalletManager from "./WalletManager.js";
import QRCodeManager from "./QRCodeManager.js";
import { MongoClient } from "mongodb";
import JWTManager from "./JWTManager.js";
import Send_Balances from "./Send_Balances.js";
import SystemConfig from "../systemConfig.js";

class MasterAuth {
    constructor(client, dbName, systemConfig) {
        if (!systemConfig) {
            throw new Error("SystemConfig is required to initialize MasterAuth.");
        }
        if (!client) {
            throw new Error("MongoClient instance is required to initialize MasterAuth.");
        }
        if (!dbName) {
            throw new Error("Database name is required to initialize MasterAuth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;

        // Initialize other components with dependencies
        this.authValidator = new AuthValidator(this.systemConfig);
        this.walletManager = new WalletManager(this.systemConfig);
        this.qrCodeManager = new QRCodeManager();
        this.jwtManager = new JWTManager(this.client, this.dbName);
        this.sendBalances = new Send_Balances(this.systemConfig);
    }

    /**
     * Close the MongoDB connection.
     */
    async close() {
        await this.client.close();
        console.log("MongoDB connection closed.");
    }

    /**
     * Process an authentication request.
     * @param {string} user_name - The user's name.
     * @param {string} game_name - The name of the game.
     * @param {string} auth_type - The authentication type (e.g., 'metamask').
     * @param {string} wallet_address - The user's wallet address.
     */
    async processAuthRequest(user_name, game_name, auth_type, wallet_address) {
        // Validate parameters
        if (!user_name || typeof user_name !== "string") {
            throw new Error("Invalid or missing user_name.");
        }
        if (!game_name || typeof game_name !== "string") {
            throw new Error("Invalid or missing game_name.");
        }
        if (!auth_type || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
            throw new Error("Invalid or missing auth_type. Must be 'metamask' or 'stargazer'.");
        }
        if (!wallet_address || typeof wallet_address !== "string") {
            throw new Error("Invalid or missing wallet_address.");
        }

        try {
            // Check if the user already exists in the database
            const userExists = await this.checkIfUsernameExists(user_name);

            if (userExists) {
                // User already exists, generate a token
                const token = await this.jwtManager.generateToken(user_name, wallet_address, game_name);
                await this.sendBalances.sendBalances(wallet_address, userExists.auth_wallets, game_name);

                return {
                    status: "success",
                    message: "User already registered.",
                    token,
                };
            } else {
                // New user, request wallet authentication
                const authMessage = this.generateAuthMessage(wallet_address);
                return {
                    status: "success",
                    message: "Please sign this message from your wallet.",
                    data: { message: authMessage },
                };
            }
        } catch (error) {
            console.error("Error processing authentication request:", {
                message: error.message,
                user_name,
                game_name,
                auth_type,
                wallet_address,
            });
            return { status: "failure", message: "Internal server error." };
        }
    }

    /**
     * Generate a wallet authentication message.
     * @param {string} wallet_address - The wallet address.
     * @returns {string} - The message to be signed.
     */
    generateAuthMessage(wallet_address) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${wallet_address} - ${timestamp}`;
    }

    /**
     * Check if a username exists in the database.
     * @param {string} user_name - The username to check.
     * @returns {boolean} - True if the user exists, otherwise false.
     */
    async checkIfUsernameExists(user_name) {
        try {
            const db = this.client.db(this.dbName);
            const usersCollection = db.collection("users");
            const existingUser = await usersCollection.findOne({ user_name });
            return existingUser || null;
        } catch (error) {
            console.error("Error checking if username exists:", { message: error.message, user_name });
            throw new Error("Database error.");
        }
    }

    /**
     * Verify the signed message from the user's wallet.
     * @param {string} wallet_address - The wallet address.
     * @param {string} signed_message - The signed message from the wallet.
     * @param {string} auth_type - The authentication type.
     * @param {string} game_name - The game name.
     * @param {string} user_name - The username.
     * @returns {object} - The verification result.
     */
    async verifySignedMessage(wallet_address, signed_message, auth_type, game_name, user_name) {
        try {
            // Validate the wallet signature
            const isAuthenticated = await this.authValidator.validateWallet(auth_type, wallet_address, signed_message);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            const userExists = await this.checkIfUsernameExists(user_name);

            if (userExists) {
                const token = await this.jwtManager.generateToken(user_name, wallet_address, game_name);
                await this.sendBalances.sendBalances(wallet_address, userExists.auth_wallets, game_name);

                return {
                    status: "success",
                    message: `Welcome back, ${user_name}!`,
                    token,
                    walletData: userExists.auth_wallets,
                };
            }

            // Register a new user
            const generatedWallets = await this.walletManager.generateWalletsForNetworks(user_name, wallet_address);
            await this.qrCodeManager.generateQRCodeForWallets(user_name, generatedWallets);
            await this.sendBalances.sendBalances(wallet_address, generatedWallets, game_name);

            const token = await this.jwtManager.generateToken(user_name, generatedWallets, game_name);

            return {
                status: "success",
                message: `Welcome ${user_name}! Wallet authenticated and registered.`,
                token,
                walletData: generatedWallets,
            };
        } catch (error) {
            console.error("Error during signature verification:", {
                message: error.message,
                wallet_address,
                signed_message,
                auth_type,
                game_name,
                user_name,
            });
            return { status: "failure", message: "Internal server error during authentication." };
        }
    }
}

export default MasterAuth;
