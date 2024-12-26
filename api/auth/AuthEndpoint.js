import express from "express";
import bodyParser from "body-parser";
import MasterAuth from "../../HVM/MasterAuth.js";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";

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
        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
    }

    /**
     * Handle incoming authentication requests.
     */
    async handleRequest(req, res) {
        const { user_name, auth_type, user_data, qr_code } = req.body;

        console.log("Incoming request body:", req.body);

        // QR Code generation
        if (qr_code === "qr_code") {
            if (!auth_type || typeof auth_type !== "string" || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
                return res.status(400).json({
                    status: "failure",
                    message: "Invalid or missing auth_type. Must be 'metamask' or 'stargazer'.",
                });
            }

            try {
                const qrCodeResult = await this.qrCodeAuth.generateQRCode("default_game", auth_type);

                const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);

                res.setHeader("Content-Type", "image/png");
                return res.send(qrCodeImage);
            } catch (error) {
                console.error("QR Code generation error:", error.message);
                return res.status(500).json({
                    status: "failure",
                    message: "Internal server error during QR code generation.",
                });
            }
        }

        // Authentication request validation
        if (!auth_type || typeof auth_type !== "string" || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
            return res.status(400).json({
                status: "failure",
                message: "Invalid or missing auth_type. Must be 'metamask' or 'stargazer'.",
            });
        }

        if (!user_data || typeof user_data !== "string" || user_data.trim() === "") {
            return res.status(400).json({
                status: "failure",
                message: "Invalid or missing user_data. Must be a public wallet address.",
            });
        }

        const username = user_name || `temp_name#${Math.floor(Math.random() * 100000)}`;

        try {
            // Check if wallet address already exists
            const walletExists = await this.checkIfWalletExists(user_data);
            if (walletExists) {
                return res.status(400).json({
                    status: "failure",
                    message: "This wallet is already registered with another account.",
                });
            }

            // Correctly assign and pass the data to MasterAuth
            const authResult = await this.masterAuth.processAuthRequest(
                username,           // Correct username
                "default_game",     // Correct game_name
                auth_type,          // Correct auth_type ('metamask' or 'stargazer')
                user_data           // Pass user_data directly as the wallet address
            );

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
            console.error("Authentication error:", error.message);
            return res.status(500).json({
                status: "failure",
                message: "Internal server error during authentication.",
            });
        }
    }

    /**
     * Check if a wallet address already exists in the database.
     * @param {string} wallet_address - The wallet address to check.
     * @returns {boolean} - True if the wallet exists, otherwise false.
     */
    async checkIfWalletExists(wallet_address) {
        try {
            await this.connectToDB();
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
}

export default AuthEndpoint;
