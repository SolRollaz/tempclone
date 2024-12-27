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
        console.log("Raw request body received:", JSON.stringify(req.body, null, 2));

        // Validate `auth_type` for all requests
        if (!auth_type || typeof auth_type !== "string" || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
            return this.sendErrorResponse(res, "Invalid or missing auth_type. Must be 'metamask' or 'stargazer'.", 400);
        }

        // Handle QR Code requests
        if (qr_code === "qr_code") {
            return await this.handleQRCodeRequest(res, auth_type);
        }

        // Handle full authentication requests
        if (!user_data || typeof user_data !== "string" || user_data.trim() === "") {
            return this.sendErrorResponse(res, "Invalid or missing user_data. Must be a public wallet address.", 400);
        }

        const username = user_name || `temp_name#${Math.floor(Math.random() * 100000)}`;

        try {
            const walletExists = await this.checkIfWalletExists(user_data);
            if (walletExists) {
                return this.sendErrorResponse(res, "This wallet is already registered with another account.", 400);
            }

            const authResult = await this.masterAuth.processAuthRequest(
                username,       // Correct username
                "default_game", // Correct game_name
                auth_type,      // Correct auth_type ('metamask' or 'stargazer')
                user_data       // Correct wallet address
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
            console.error("Authentication error:", {
                message: error.message,
                user_name: username,
                auth_type,
                user_data,
            });
            return this.sendErrorResponse(res, "Internal server error during authentication.", 500);
        }
    }

    /**
     * Handle QR Code requests.
     * Allows generation of QR codes with only `auth_type` and `qr_code` specified.
     */
    async handleQRCodeRequest(res, auth_type) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateQRCode("default_game", auth_type);
            const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);

            res.setHeader("Content-Type", "image/png");
            return res.send(qrCodeImage);
        } catch (error) {
            console.error("QR Code generation error:", error.message);
            return this.sendErrorResponse(res, "Internal server error during QR code generation.", 500);
        }
    }

    /**
     * Check if a wallet address already exists in the database.
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
