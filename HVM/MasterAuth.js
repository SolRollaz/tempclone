import AuthValidator from './AuthValidator.js';
import WalletManager from './WalletManager.js';
import QRCodeManager from './QRCodeManager.js';
import { MongoClient } from 'mongodb'; // MongoDB import remains the same
import JWTManager from './JWTManager.js';
import Send_Balances from './Send_Balances.js';
import SystemConfig from '../systemConfig.js'; // Include .js extension

class MasterAuth {
    constructor() {
        this.systemConfig = new SystemConfig(); // Centralized configuration instance
        this.authValidator = new AuthValidator(this.systemConfig); // Pass SystemConfig to dependent classes
        this.walletManager = new WalletManager(this.systemConfig); // WalletManager now handles user addition
        this.qrCodeManager = new QRCodeManager(this.systemConfig);
        this.mongoDBClient = new MongoDBClient();
        this.jwtManager = new JWTManager();
        this.sendBalances = new Send_Balances(this.systemConfig); // Send_Balances to send balances
    }

    // Orchestrate all actions (authentication, wallet generation, QR code generation, etc.)
    async processAuthRequest(game_key, user_name, game_name, auth_type, user_data) {
        try {
            const userExists = await this.checkIfUsernameExists(user_name);
            let token;

            if (userExists) {
                // User is already registered, generate a player token
                token = await this.jwtManager.generateToken(user_name, user_data.auth_wallets, game_name);
                // Send the balances to the game API for the authenticated user
                await this.sendBalances.sendBalances(user_data.wallet_address, user_data.auth_wallets, game_name);
                return { status: "success", message: "User already registered.", token };
            } else {
                // User is not registered, proceed with wallet authentication
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

    // Generate a message that the user will sign to authenticate
    generateAuthMessage(wallet_address) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${wallet_address} - ${timestamp}`;
    }

    // Check if the username already exists in the database
    async checkIfUsernameExists(user_name) {
        try {
            const db = await this.mongoDBClient.connectToDB();
            const usersCollection = db.collection("users");
            const existingUser = await usersCollection.findOne({ user_name });
            return existingUser !== null;
        } catch (error) {
            console.error("Error checking if username exists:", { message: error.message, user_name });
            throw new Error("Database error.");
        }
    }

    // Once user signs the message in their wallet, backend verifies the signature
    async verifySignedMessage(wallet_address, signed_message, auth_type, game_name, user_name) {
        try {
            // Step 1: Validate wallet signature
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

            const generatedWallets = await this.walletManager.generateHyprmtrxWallets(user_name, wallet_address);

            await this.qrCodeManager.generateQRCodeForWallets(wallet_address, generatedWallets);

            const balanceResult = await this.sendBalances.sendBalances(wallet_address, generatedWallets, game_name);
            if (balanceResult.status === "failure") {
                return { status: "failure", message: "Failed to send balances and logos to the game." };
            }

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
