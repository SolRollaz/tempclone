import AuthValidator from "./AuthValidator.js";
import WalletManager from "./WalletManager.js";
import JWTManager from "./JWTManager.js";
import Send_Balances from "./Send_Balances.js";
import SystemConfig from "../systemConfig.js";

class MasterAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, database name, and SystemConfig are required to initialize MasterAuth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;

        this.authValidator = new AuthValidator(this.systemConfig);
        this.walletManager = new WalletManager(this.systemConfig);
        this.jwtManager = new JWTManager(this.client, this.dbName);
        this.sendBalances = new Send_Balances(this.systemConfig);
    }

    generateAuthMessage(walletAddress) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${timestamp}`;
    }

    async verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName) {
        try {
            const message = this.generateAuthMessage(walletAddress);
            const isAuthenticated = await this.authValidator.validateWallet(authType, walletAddress, signedMessage, message);

            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            const userExists = await this.checkIfUsernameExists(userName);

            if (userExists) {
                const token = await this.jwtManager.generateToken(userName, walletAddress, gameName);
                await this.sendBalances.sendBalances(walletAddress, userExists.auth_wallets, gameName);

                return {
                    status: "success",
                    message: `Welcome back, ${userName}!`,
                    token,
                    walletData: userExists.auth_wallets,
                };
            }

            const generatedWallets = await this.walletManager.generateWalletsForNetworks(userName, walletAddress);
            const token = await this.jwtManager.generateToken(userName, generatedWallets, gameName);

            return {
                status: "success",
                message: `Welcome ${userName}! Wallet authenticated and registered.`,
                token,
                walletData: generatedWallets,
            };
        } catch (error) {
            console.error("Error verifying signed message:", error.message);
            return { status: "failure", message: "Internal server error during authentication." };
        }
    }

    async checkIfUsernameExists(userName) {
        try {
            const db = this.client.db(this.dbName);
            const usersCollection = db.collection("users");
            return await usersCollection.findOne({ user_name: userName });
        } catch (error) {
            console.error("Error checking if username exists:", error.message);
            throw new Error("Database error.");
        }
    }
}

export default MasterAuth;
