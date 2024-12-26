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
        this.jwtManager = new JWTManager(this.client, this.dbName); // Pass MongoClient and DB name
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
     */
    async processAuthRequest(game_key, user_name, game_name, auth_type, user_data) {
        try {
            const userExists = await this.checkIfUsernameExists(user_name);
            let token;

            if (userExists) {
                // User already registered, generate a player token
                token = await this.jwtManager.generateToken(user_name, user_data.auth_wallets, game_name);
                await this.sendBalances.sendBalances(user_data.wallet_address, user_data.auth_wallets, game_name);
                return { status: "success", message: "User already registered.", token };
            } else {
                // User not registered, prompt for wallet authentication
                const message = this.generateAuthMessage(user_data.wallet_address);
                return { status: "success", message: "Please sign this message from your wallet.", data: { message } };
            }
        } catch (error) {
            console.error("Error processing authentication request:", {
                message: error.message,
                user_name,
                game_name,
                auth_type,
            });
            return { status: "failure", message: "Internal server error." };
        }
    }

    /**
     * Generate a wallet authentication message.
     */
    generateAuthMessage(wallet_address) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${wallet_address} - ${timestamp}`;
    }

    /**
     * Check if a username exists in the database.
     */
    async checkIfUsernameExists(user_name) {
        try {
            const db = this.client.db(this.dbName);
            const usersCollection = db.collection("users");
            const existingUser = await usersCollection.findOne({ user_name });
            return existingUser !== null;
        } catch (error) {
            console.error("Error checking if username exists:", { message: error.message, user_name });
            throw new Error("Database error.");
        }
    }

    /**
     * Verify the signed message from the user's wallet.
     */
    async verifySignedMessage(wallet_address, signed_message, auth_type, game_name, user_name) {
        try {
            // Validate wallet signature
            const isAuthenticated = await this.authValidator.validateWallet(auth_type, wallet_address, signed_message);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            const userExists = await this.checkIfUsernameExists(user_name);
            let token;

            if (userExists) {
                token = await this.jwtManager.generateToken(user_name, wallet_address, game_name);
                await this.sendBalances.sendBalances(wallet_address, userExists.auth_wallets, game_name);
                return {
                    status: "success",
                    message: `Welcome back, ${user_name}!`,
                    token,
                    walletData: userExists.auth_wallets,
                };
            }

            // Generate wallets for networks and register the user
            const generatedWallets = await this.walletManager.generateWalletsForNetworks(user_name, wallet_address);
            await this.qrCodeManager.generateQRCodeForWallets(user_name, generatedWallets);
            await this.sendBalances.sendBalances(wallet_address, generatedWallets, game_name);

            token = await this.jwtManager.generateToken(user_name, generatedWallets, game_name);

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
