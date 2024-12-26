import jwt from "jsonwebtoken";
import SystemConfig from "../systemConfig.js"; // `.js` is mandatory for local imports

class JWTManager {
    constructor(mongoClient, dbName) {
        if (!mongoClient) {
            throw new Error("MongoClient instance is required to initialize JWTManager.");
        }
        if (!dbName) {
            throw new Error("Database name is required to initialize JWTManager.");
        }

        this.mongoClient = mongoClient;  // MongoDB client instance
        this.dbName = dbName;            // Database name
        this.jwtSecret = process.env.JWT_SECRET || "DEFAULT_SECRET"; // Load secret securely
        this.usersCollection = this.mongoClient.db(this.dbName).collection("users"); // Access the users collection
        this.systemConfig = new SystemConfig(); // Integrating SystemConfig to fetch network data
    }

    /**
     * Generate a JWT token for a user.
     * @param {string} user_name - The user name.
     * @param {object} authWallets - The user's authentication wallet details.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB') for which to generate the token.
     * @returns {string} - The JWT token.
     */
    async generateToken(user_name, authWallets, network) {
        try {
            // Validate network with SystemConfig
            const networkConfig = this.systemConfig.getNetworkConfig(network);

            // Include the network-specific feeWallet and other settings in the token payload
            const payload = {
                user_name,
                authWallets,
                networkConfig, // Adds network-specific information to the payload (feeWallet, RPC URL, etc.)
            };

            const token = jwt.sign(payload, this.jwtSecret, { expiresIn: "1h" });

            // Store the token in the MongoDB users collection (optional)
            await this.storeToken(user_name, token);

            return token;
        } catch (error) {
            console.error("Error generating token:", { user_name, error: error.message });
            throw new Error("Failed to generate token.");
        }
    }

    /**
     * Store the generated token in the MongoDB users collection.
     * @param {string} user_name - The user name to store the token for.
     * @param {string} token - The JWT token to store.
     */
    async storeToken(user_name, token) {
        try {
            const result = await this.usersCollection.updateOne(
                { user_name },
                { $push: { tokens: token } },  // Use $push to add the token to the array
                { upsert: true } // Create a new document if user doesn't exist
            );

            if (result.modifiedCount === 0 && result.upsertedCount === 0) {
                console.warn("No changes made to the user document. Verify the user exists.");
            }
        } catch (error) {
            console.error("Error storing token in MongoDB:", { user_name, error: error.message });
            throw new Error("Failed to store token in database.");
        }
    }

    /**
     * Validate the JWT token.
     * @param {string} token - The JWT token to validate.
     * @returns {object} - The decoded payload of the token if valid, or an error if invalid.
     */
    async validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                console.warn("Token has expired.");
                throw new Error("Token has expired.");
            }
            console.error("Invalid token:", error.message);
            throw new Error("Invalid token.");
        }
    }
}

export default JWTManager;
