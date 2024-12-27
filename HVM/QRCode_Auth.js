import { MetaMaskSDK } from "@metamask/sdk";
import qrCode from "qrcode";
import fs from "fs";
import path from "path";

class QR_Code_Auth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, dbName, and SystemConfig are required to initialize QR_Code_Auth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;
        this.qrCodeDir = path.join(process.cwd(), "QR_Codes");

        // Initialize MetaMask SDK
        this.metaMaskSDK = new MetaMaskSDK({
            dappMetadata: {
                name: "HyperMatrix",
                description: "Authentication with MetaMask via HyperMatrix",
                url: "https://hyprmtrx.xyz",
            },
        });
        this.ethereum = this.metaMaskSDK.getProvider();

        this.ensureQRCodeDirectory();
    }

    /**
     * Ensures the QR code directory exists.
     */
    ensureQRCodeDirectory() {
        try {
            if (!fs.existsSync(this.qrCodeDir)) {
                fs.mkdirSync(this.qrCodeDir, { recursive: true });
                console.log("QR code directory created.");
            }
        } catch (error) {
            console.error("Error ensuring QR code directory:", error.message);
            throw error;
        }
    }

    /**
     * Generate the authentication QR code for signing.
     * @param {string} walletAddress - The user's wallet address.
     * @param {string} sessionId - Session ID.
     * @returns {object} - QR code generation result.
     */
    async generateAuthenticationQRCode(walletAddress, sessionId) {
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            throw new Error("Invalid wallet address.");
        }

        try {
            const filePath = path.join(this.qrCodeDir, `${sessionId}_auth_qrcode.png`);

            const message = `Sign this message to authenticate: ${sessionId}`;
            const qrCodeData = {
                method: "personal_sign",
                params: [message, walletAddress],
                session_id: sessionId,
                timestamp: Date.now(),
            };

            console.log("Generated QR Code Data (Authentication):", qrCodeData);

            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`QR code generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "QR code generated successfully.",
                qr_code_path: filePath,
                session_id: sessionId,
            };
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return { status: "failure", message: "Failed to generate QR code." };
        }
    }
}

export default QR_Code_Auth;
