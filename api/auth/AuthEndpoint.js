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

        // Get MongoDB URI and Database Name from SystemConfig or environment variables
        const mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        const dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        // Validate MongoDB connection details
        if (!mongoUri) {
            throw new Error("Mongo URI is not defined. Please check your environment variables or SystemConfig.");
        }
        if (!dbName) {
            throw new Error("Mongo DB Name is not defined. Please check your environment variables or SystemConfig.");
        }

        this.mongoUri = mongoUri;
        this.dbName = dbName;
        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });

        console.log("Mongo URI being used:", this.mongoUri);
        console.log("Mongo DB Name being used:", this.dbName);

        // Initialize other dependencies and pass required dependencies
        this.masterAuth = new MasterAuth(this.client, this.dbName, this.systemConfig);
        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
    }

    /**
     * Handle incoming authentication requests.
     */
    async handleRequest(req, res) {
        const { user_name, auth_type, user_data, qr_code } = req.body;

        // Handle QR code generation and response
        if (qr_code === "qr_code") {
            try {
                const qrCodeResult = await this.qrCodeAuth.generateQRCode("default_game");

                // Read the generated QR code file
                const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);

                // Send the QR code image back to Unity
                res.setHeader("Content-Type", "image/png");
                return res.send(qrCodeImage);
            } catch (error) {
                console.error("Error during QR Code generation:", error.message);
                return res.status(500).json({
                    status: "failure",
                    message: "Internal server error during QR code generation.",
                });
            }
        }

        // Validate required fields for wallet authentication
        if (!auth_type || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
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
            // Check if the wallet address already exists
            const walletExists = await this.checkIfWalletExists({ wallet_address: user_data });
            if (walletExists) {
                return res.status(400).json({
                    status: "failure",
                    message: "This wallet is already registered with another account.",
                });
            }

            // Proceed with wallet authentication using MasterAuth
            const authResult = await this.masterAuth.processAuthRequest(
                username,
                "default_game",
                auth_type,
                { wallet_address: user_data }
            );

            if (authResult.status === "success") {
                return res.json({
                    status: "success",
                    message: `Welcome ${username}! Authentication successful.`,
                    token: authResult.token,
                    walletData: authResult.walletData,
                });
            } else {
                return res.status(401).json(authResult); // Return failure message from MasterAuth
            }
        } catch (error) {
            console.error("Error during authentication:", error.message);
            return res.status(500).json({
                status: "failure",
                message: "Internal server error during authentication.",
            });
        }
    }

    /**
     * Check if a wallet address already exists in the users collection.
     * @param {Object} user_data - The user data containing wallet address.
     * @returns {boolean} - True if the wallet exists, otherwise false.
     */
    async checkIfWalletExists(user_data) {
        try {
            await this.connectToDB();
            const { wallet_address } = user_data;
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
