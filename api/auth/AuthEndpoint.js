import express from "express";
import MasterAuth from "../../HVM/MasterAuth.js";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";

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
            res.status(500).send({ status: "failure", message: "Internal server error." });
        }
    }

    async handleQRCodeRequest(res, user_data) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode(user_data);

            if (qrCodeResult.status !== "success") {
                return res.status(500).send({ status: "failure", message: qrCodeResult.message });
            }

            const qrCodePath = qrCodeResult.qr_code_path;

            if (!fs.existsSync(qrCodePath)) {
                return res.status(500).send({ status: "failure", message: "QR Code file not found." });
            }

            // Send the image file directly
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", "inline; filename=qr_code.png");

            const qrStream = fs.createReadStream(qrCodePath);
            qrStream.pipe(res);
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            res.status(500).send({ status: "failure", message: "Failed to generate QR code." });
        }
    }
}

export default AuthEndpoint;
