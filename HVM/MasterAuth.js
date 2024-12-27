import AuthValidator from "./AuthValidator.js";
import JWTManager from "./JWTManager.js";

class MasterAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, database name, and SystemConfig are required to initialize MasterAuth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.authValidator = new AuthValidator();
        this.jwtManager = new JWTManager(this.client, this.dbName);
    }

    /**
     * Generate an authentication message for the user.
     * @param {string} walletAddress - Wallet address of the user.
     * @returns {string} - Message to sign.
     */
    generateAuthMessage(walletAddress) {
        return `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${Date.now()}`;
    }

    /**
     * Verify the signed message from the user's wallet.
     * @param {string} walletAddress - Wallet address.
     * @param {string} signedMessage - Signed message from wallet.
     * @param {string} authType - Authentication type.
     * @returns {object} - Verification result.
     */
    async verifySignedMessage(walletAddress, signedMessage, authType) {
        try {
            const message = this.generateAuthMessage(walletAddress);
            const isAuthenticated = await this.authValidator.authenticateWithMetamask(message, signedMessage, walletAddress);

            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            const token = await this.jwtManager.generateToken(walletAddress);
            return { status: "success", message: "Authentication successful.", token };
        } catch (error) {
            console.error("Error verifying signed message:", error.message);
            return { status: "failure", message: "Internal server error during authentication." };
        }
    }
}

export default MasterAuth;
