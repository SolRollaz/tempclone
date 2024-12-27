import express from "express";
import bodyParser from "body-parser";
import MasterAuth from "../../HVM/MasterAuth.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";

class AuthEndpoint {
    constructor() {
        // Initialize SystemConfig
        this.systemConfig = new SystemConfig();

        // Get MongoDB URI and Database Name
        const mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        const dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        if (!mongoUri) {
            throw new Error("Mongo URI is not defined. Please check your environment variables or SystemConfig.");
        }
        if (!dbName) {
            throw new Error("Mongo DB Name is not defined. Please check your environment variables or SystemConfig.");
        }

        this.mongoUri = mongoUri;
        this.dbName = dbName;
        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });

        console.log("Mongo URI:", this.mongoUri);
        console.log("Mongo DB Name:", this.dbName);

        this.masterAuth = new MasterAuth(this.client, this.dbName, this.systemConfig);
    }

    /**
     * Handle incoming authentication requests.
     */
    async handleRequest(req, res) {
        const { user_data, auth_type, user_name, game_name } = req.body;
        console.log("Raw request body received:", JSON.stringify(req.body, null, 2));

        // Validate input
        if (!auth_type || typeof auth_type !== "string" || auth_type.toLowerCase() !== "metamask") {
            return this.sendErrorResponse(res, "Invalid or missing auth_type. Must be 'metamask'.", 400);
        }

        if (!user_data || typeof user_data !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(user_data)) {
            return this.sendErrorResponse(res, "Invalid or missing user_data. Must be a valid Ethereum wallet address.", 400);
        }

        const username = user_name || `temp_name#${Math.floor(Math.random() * 100000)}`;
        const game = game_name || "default";

        try {
            await this.connectToDB();

            // Check if the wallet address already exists in the database
            const walletExists = await this.checkIfWalletExists(user_data);
            if (walletExists) {
                return this.sendErrorResponse(res, "This wallet is already registered with another account.", 400);
            }

            // Process the authentication request
            const authResult = await this.masterAuth.processAuthRequest(username, game, auth_type, user_data);

            if (authResult.status === "success") {
                return res.json({
                    status: "success",
                    message: `Welcome ${username}! Authentication successful.`,
                    token: authResult.token,
                    walletData: authResult.walletData,
                });
            } else {
                return res.status(401).json(authResult);
            }
        } catch (error) {
            console.error("Error handling authentication request:", error.message);
            return this.sendErrorResponse(res, "Internal server error during authentication.", 500);
        }
    }

    /**
     * Check if a wallet address already exists in the database.
     */
    async checkIfWalletExists(wallet_address) {
        try {
            const db = this.client.db(this.dbName);
            const usersCollection = db.collection("users");

            const existingUser = await usersCollection.findOne({
                "auth_wallets.wallet_address": wallet_address,
            });

            return existingUser !== null;
        } catch (error) {
            console.error("Error checking wallet existence:", error.message);
            throw error;
        }
    }

    /**
     * Connect to MongoDB.
     */
    async connectToDB() {
        try {
            if (!this.client.topology?.isConnected()) {
                await this.client.connect();
                console.log("Connected to MongoDB.");
            }
        } catch (error) {
            console.error("MongoDB connection error:", error.message);
            throw error;
        }
    }

    /**
     * Send error response with a consistent structure.
     */
    sendErrorResponse(res, message, statusCode) {
        return res.status(statusCode).json({
            status: "failure",
            message,
        });
    }
}

export default AuthEndpoint;
