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

        // Initialize MasterAuth with properly defined variables
        this.masterAuth = new MasterAuth(this.client, this.dbName, this.systemConfig);
    }

    async handleRequest(req, res) {
        const { user_data, auth_type, signed_message } = req.body;

        if (!auth_type || auth_type.toLowerCase() !== "metamask") {
            return res.status(400).json({ status: "failure", message: "Invalid or missing auth_type." });
        }

        if (!user_data) {
            return res.status(400).json({ status: "failure", message: "Missing wallet address." });
        }

        if (!signed_message) {
            const authMessage = this.masterAuth.generateAuthMessage(user_data);
            return res.json({ status: "awaiting_signature", message: "Please sign the provided message.", data: { authMessage } });
        } else {
            const result = await this.masterAuth.verifySignedMessage(user_data, signed_message, auth_type);
            return res.json(result);
        }
    }

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
