import express from "express";
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

        if (!mongoUri || !dbName) {
            throw new Error("Mongo URI or DB Name is not defined.");
        }

        this.mongoUri = mongoUri;
        this.dbName = dbName;
        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });

        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
    }

    async handleRequest(req, res) {
        console.log("---- Incoming Request ----");
        console.log("Body:", req.body);

        const { user_data, auth_type } = req.body;

        if (!auth_type || auth_type.toLowerCase() !== "metamask") {
            return res.status(400).send({ status: "failure", message: "Invalid or missing auth_type." });
        }

        if (!user_data || !/^0x[a-fA-F0-9]{40}$/.test(user_data)) {
            return res.status(400).send({ status: "failure", message: "Invalid or missing user_data." });
        }

        try {
            await this.client.connect();
            return await this.handleQRCodeRequest(res, user_data);
        } catch (error) {
            console.error("Error handling request:", error.message);
            return res.status(500).send({ status: "failure", message: "Internal server error." });
        }
    }

    async handleQRCodeRequest(res, user_data) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode(user_data);

            // Check the QR Code generation result
            if (!qrCodeResult || qrCodeResult.status !== "success") {
                console.error("QR Code generation failed:", qrCodeResult?.message || "Unknown error");
                return res.status(500).send({ status: "failure", message: qrCodeResult?.message || "QR Code generation failed." });
            }

            const qrCodePath = qrCodeResult.qr_code_path;

            // Validate that the path is defined
            if (!qrCodePath) {
                console.error("QR Code path is undefined:", qrCodeResult);
                return res.status(500).send({ status: "failure", message: "QR Code path is undefined." });
            }

            console.log(`Attempting to stream QR Code from path: ${qrCodePath}`);

            // Stream the file to the response
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", `inline; filename=${path.basename(qrCodePath)}`);

            const qrStream = fs.createReadStream(qrCodePath);
            qrStream.pipe(res);

            qrStream.on("close", () => {
                console.log(`QR Code successfully streamed to the client: ${qrCodePath}`);
            });

            qrStream.on("error", (error) => {
                console.error("Error streaming the QR Code file:", error.message);
                return res.status(500).send({ status: "failure", message: "Error streaming the QR Code file." });
            });
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return res.status(500).send({ status: "failure", message: "Failed to generate QR code." });
        }
    }
}

export default AuthEndpoint;
