import AuthValidator from "./AuthValidator.js";
import WalletManager from "./WalletManager.js";
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
        this.jwtManager = new JWTManager(this.client, this.dbName);
        this.sendBalances = new Send_Balances(this.systemConfig);
    }

    /**
     * Generate an authentication message for the user to sign.
     * @param {string} wallet_address - The wallet address.
     * @returns {string} - The message to be signed.
     */
    generateAuthMessage(wallet_address) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${wallet_address} - ${timestamp}`;
    }

    /**
     * Verify the signed message from the user's wallet.
     * @param {string} wallet_address - The wallet address.
     * @param {string} signed_message - The signed message from the wallet.
     * @param {string} auth_type - The authentication type (e.g., 'metamask').
     * @param {string} game_name - The game name.
     * @param {string} user_name - The username.
     * @returns {object} - The verification result.
     */
    async verifySignedMessage(wallet_address, signed_message, auth_type, game_name, user_name) {
        try {
            // Validate the wallet signature
            const authMessage = this.generateAuthMessage(wallet_address);
            const isAuthenticated = await this.authValidator.validateWallet(auth_type, wallet_address, signed_message, authMessage);

            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            // Check if the user already exists in the database
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
}

export default MasterAuth;
