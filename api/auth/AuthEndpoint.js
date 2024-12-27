import express from "express";
import MasterAuth from "../../HVM/MasterAuth.js";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

class AuthEndpoint {
    constructor() {
        this.systemConfig = new SystemConfig();

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
     * Handle incoming requests.
     */
    async handleRequest(req, res) {
        console.log("---- Incoming Request ----");
        console.log("Headers:", req.headers);
        console.log("Body:", req.body);
        console.log("IP Address:", req.ip);

        const { user_data, auth_type, user_name, game_name, signed_message } = req.body;

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
                return await this.handleQRCodeRequest(res, user_data, auth_type, game);
            } else {
                return await this.handleSignedMessage(res, user_data, signed_message, auth_type, username, game);
            }
        } catch (error) {
            console.error("Error handling request:", error.message);
            return this.sendErrorResponse(res, "Internal server error.", 500);
        }
    }

    /**
     * Handle QR code generation for authentication.
     */
    async handleQRCodeRequest(res, user_data, auth_type, game_name) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode(user_data);

            if (qrCodeResult.status !== "success") {
                console.error("QR Code generation failed:", qrCodeResult.message);
                return this.sendErrorResponse(res, qrCodeResult.message, 500);
            }

            console.log("Generated QR Code Result:", qrCodeResult);

            // Read the QR code as an image file
            const qrCodePath = qrCodeResult.qr_code_path;
            if (!fs.existsSync(qrCodePath)) {
                console.error("QR Code file not found at path:", qrCodePath);
                return this.sendErrorResponse(res, "QR Code file not found.", 500);
            }

            // Send the image directly in the response
            const fileExtension = path.extname(qrCodePath).toLowerCase();
            const mimeType = fileExtension === '.png' ? 'image/png' : 'image/jpeg';

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', 'inline; filename="qr_code.png"');
            
            const qrCodeStream = fs.createReadStream(qrCodePath);
            qrCodeStream.pipe(res); // Pipe the file content into the response

        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return this.sendErrorResponse(res, "Failed to generate QR code.", 500);
        }
    }

    /**
     * Handle signed message verification.
     */
    async handleSignedMessage(res, user_data, signed_message, auth_type, user_name, game_name) {
        try {
            const verificationResult = await this.masterAuth.verifySignedMessage(
                user_data,
                signed_message,
                auth_type,
                game_name,
                user_name
            );

            console.log("Verification Result:", verificationResult);

            if (verificationResult.status === "success") {
                return res.json(verificationResult);
            } else {
                return this.sendErrorResponse(res, verificationResult.message, 401);
            }
        } catch (error) {
            console.error("Error verifying signed message:", error.message);
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
        console.error("Sending error response:", { message, statusCode });
        return res.status(statusCode).json({
            status: "failure",
            message,
        });
    }
}

export default AuthEndpoint;
