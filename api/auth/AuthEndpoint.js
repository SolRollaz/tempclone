import express from "express";
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
    console.log("---- Incoming Request ----");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("IP Address:", req.ip);

    const { user_data, auth_type, user_name, game_name, signed_message } = req.body;

    // Enhanced Logging
    if (!user_data) {
        console.error("Missing 'user_data' in request.");
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(user_data)) {
        console.error("Invalid Ethereum wallet address format:", user_data);
    }

    if (!auth_type) {
        console.error("Missing 'auth_type' in request.");
    } else if (auth_type.toLowerCase() !== "metamask") {
        console.error("Unsupported 'auth_type':", auth_type);
    }

    // Validate Input
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

        if (!signed_message) {
            // Step 1: Request the user to sign a message
            const authMessage = this.masterAuth.generateAuthMessage(user_data);
            console.log("Generated auth message:", authMessage);

            return res.json({
                status: "awaiting_signature",
                message: "Please sign the provided message with your wallet.",
                data: { message: authMessage },
            });
        } else {
            // Step 2: Verify the signed message
            const verificationResult = await this.masterAuth.verifySignedMessage(
                user_data,
                signed_message,
                auth_type,
                game,
                username
            );

            console.log("Verification result:", verificationResult);

            if (verificationResult.status === "success") {
                return res.json(verificationResult);
            } else {
                console.error("Verification failed:", verificationResult.message);
                return this.sendErrorResponse(res, verificationResult.message, 401);
            }
        }
    } catch (error) {
        console.error("Error handling authentication request:", error.message);
        return this.sendErrorResponse(res, "Internal server error during authentication.", 500);
    }
}


    /**
     * Handle QR Code generation requests.
     */
    async handleQRCodeRequest(res, user_data, auth_type, game_name) {
        if (!auth_type || typeof auth_type !== "string" || auth_type.toLowerCase() !== "metamask") {
            console.error("Invalid or missing auth_type:", auth_type);
            return this.sendErrorResponse(res, "Invalid or missing auth_type. Must be 'metamask'.", 400);
        }

        if (!user_data || typeof user_data !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(user_data)) {
            console.error("Invalid or missing user_data:", user_data);
            return this.sendErrorResponse(res, "Invalid or missing user_data. Must be a valid Ethereum wallet address.", 400);
        }

        const game = game_name || "default_game";

        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode(user_data, game);
            console.log("Generated QR Code Result:", qrCodeResult);

            const qrCodeImage = fs.readFileSync(qrCodeResult.qr_code_path);
            res.setHeader("Content-Type", "image/png");
            return res.send(qrCodeImage);
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return this.sendErrorResponse(res, "Failed to generate QR code.", 500);
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
        console.error("Sending error response:", { message, statusCode });
        return res.status(statusCode).json({
            status: "failure",
            message,
        });
    }
}

export default AuthEndpoint;
