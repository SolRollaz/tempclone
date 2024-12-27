import express from "express";
import MasterAuth from "../../HVM/MasterAuth.js";

class AuthEndpoint {
    constructor() {
        this.masterAuth = new MasterAuth(client, dbName, systemConfig);
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
            // Step 1: Request signature
            const authMessage = this.masterAuth.generateAuthMessage(user_data);
            return res.json({ status: "awaiting_signature", message: "Please sign the provided message.", data: { authMessage } });
        } else {
            // Step 2: Verify signature
            const result = await this.masterAuth.verifySignedMessage(user_data, signed_message, auth_type);
            return res.json(result);
        }
    }
}

export default AuthEndpoint;
