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
        const { qr_code, auth_type, wallet_address, session_id } = req.body;
        console.log("Raw request body received:", JSON.stringify(req.body, null, 2));

        try {
            // Handle QR Code generation (step 1 or 2)
            if (qr_code === "qr_code") {
                if (!auth_type || typeof auth_type !== "string" || auth_type.toLowerCase() !== "metamask") {
                    return this.sendErrorResponse(res, "Invalid or missing auth_type. Must be 'metamask'.", 400);
                }

                // Step 1: Generate the first QR code for wallet address retrieval
                if (!wallet_address && !session_id) {
                    return await this.handleAddressRequestQRCode(res, auth_type);
                }

                // Step 2: Generate the second QR code for wallet authentication
                if (wallet_address && session_id) {
                    return await this.handleAuthenticationQRCode(res, wallet_address, session_id);
                }

                return this.sendErrorResponse(
                    res,
                    "Invalid QR code request. Must include only 'auth_type' for step 1 or both 'wallet_address' and 'session_id' for step 2.",
                    400
                );
            }

            // Handle wallet authentication
            if (wallet_address && session_id) {
                return await this.handleAuthentication(res, wallet_address, session_id);
            }

            return this.sendErrorResponse(res, "Invalid request format.", 400);
        } catch (error) {
            console.error("Error handling request:", error.message);
            return this.sendErrorResponse(res, "Internal server error.", 500);
        }
    }

    /**
     * Handle address request QR code generation (step 1).
     */
    async handleAddressRequestQRCode(res, auth_type) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAddressRequestQRCode("default_game", auth_type);
            console.log("Address Request QR Code Generated:", qrCodeResult);

            const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);
            res.setHeader("Content-Type", "image/png");
            return res.send(qrCodeImage);
        } catch (error) {
            console.error("Error generating address request QR code:", error.message);
            return this.sendErrorResponse(res, "Failed to generate address request QR code.", 500);
        }
    }

    /**
     * Handle authentication QR code generation (step 2).
     */
    async handleAuthenticationQRCode(res, wallet_address, session_id) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode(wallet_address, session_id);
            console.log("Authentication QR Code Generated:", qrCodeResult);

            const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);
            res.setHeader("Content-Type", "image/png");
            return res.send(qrCodeImage);
        } catch (error) {
            console.error("Error generating authentication QR code:", error.message);
            return this.sendErrorResponse(res, "Failed to generate authentication QR code.", 500);
        }
    }

    /**
     * Handle wallet authentication after scanning.
     */
    async handleAuthentication(res, wallet_address, session_id) {
        try {
            const authResult = await this.qrCodeAuth.authenticateWalletAddress(wallet_address, session_id);

            if (authResult.status === "success") {
                return res.json(authResult);
            } else {
                return this.sendErrorResponse(res, authResult.message, 400);
            }
        } catch (error) {
            console.error("Authentication error:", error.message);
            return this.sendErrorResponse(res, "Internal server error during authentication.", 500);
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
