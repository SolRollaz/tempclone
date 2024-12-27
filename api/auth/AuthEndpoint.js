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

        const { user_data, auth_type, qr_code, game_name } = req.body;

        try {
            await this.connectToDB();

            if (qr_code === "qr_code") {
                // Handle QR Code generation for the user's wallet address
                return await this.handleQRCodeRequest(res, user_data, auth_type, game_name);
            } else {
                console.error("Invalid request format:", req.body);
                return this.sendErrorResponse(res, "Invalid request format.", 400);
            }
        } catch (error) {
            console.error("Error handling request:", error.message);
            return this.sendErrorResponse(res, "Internal server error.", 500);
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
