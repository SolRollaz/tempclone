import AuthValidator from './AuthValidator.js';
import WalletManager from './WalletManager.js';
import QRCodeManager from './QRCodeManager.js';
import { MongoClient } from 'mongodb'; // MongoDB import
import JWTManager from './JWTManager.js';
import Send_Balances from './Send_Balances.js';
import SystemConfig from '../systemConfig.js'; // Ensure .js extension

class MasterAuth {
    constructor() {
        // Initialize SystemConfig
        this.systemConfig = new SystemConfig();

        // Extract MongoDB configurations
        const mongoUri = this.systemConfig.getMongoUri();
        const dbName = this.systemConfig.getMongoDbName();

        // Validate MongoDB configurations
        if (!mongoUri) {
            throw new Error("MongoDB URI is undefined or invalid.");
        }

        if (!dbName) {
            throw new Error("MongoDB database name is undefined.");
        }

        // Initialize MongoDB client
        this.mongoDBClient = new MongoClient(mongoUri, { useUnifiedTopology: true });
        this.dbName = dbName;

        // Connect to MongoDB
        this.mongoDBClient.connect().then(() => {
            console.log("Successfully connected to MongoDB.");
        }).catch((error) => {
            console.error("Error connecting to MongoDB:", error.message);
            throw new Error("Failed to connect to MongoDB.");
        });

        // Initialize other components with dependencies
        this.authValidator = new AuthValidator(this.systemConfig);
        this.walletManager = new WalletManager(this.systemConfig);
        this.qrCodeManager = new QRCodeManager();
        this.jwtManager = new JWTManager(this.mongoDBClient, this.dbName); // Pass MongoDB client and DB name
        this.sendBalances = new Send_Balances(this.systemConfig);
    }

    /**
     * Close the MongoDB connection.
     */
    async close() {
        await this.mongoDBClient.close();
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
            const db = this.mongoDBClient.db(this.dbName);
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
