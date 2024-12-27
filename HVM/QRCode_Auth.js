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
     * Ensures the QR code directory exists and is writable.
     */
    ensureQRCodeDirectory() {
        try {
            if (!fs.existsSync(this.qrCodeDir)) {
                fs.mkdirSync(this.qrCodeDir, { recursive: true });
                console.log("QR code directory created.");
            }
            fs.accessSync(this.qrCodeDir, fs.constants.W_OK);
            console.log("QR code directory is writable.");
        } catch (error) {
            console.error("Error ensuring QR code directory:", error.message);
            throw new Error("QR code directory is not writable or accessible.");
        }
    }

    /**
     * Generate a QR code for MetaMask authentication.
     * @param {string} walletAddress - The user's wallet address.
     * @returns {object} - QR code generation result with a public URL.
     */
    async generateAuthenticationQRCode(walletAddress) {
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            throw new Error("Invalid wallet address.");
        }

        try {
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sessionId = `session_${uniqueId}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_auth_qrcode.png`);
            const publicUrl = `https://hyprmtrx.xyz/qr-codes/${path.basename(filePath)}`;

            const message = `Sign this message to authenticate: ${walletAddress} - ${Date.now()}`;
            const qrCodeData = {
                method: "personal_sign",
                params: [message, walletAddress],
                session_id: sessionId,
            };

            console.log(`[Session: ${sessionId}] Generated QR Code Data:`, qrCodeData);

            // Generate QR code
            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`[Session: ${sessionId}] QR code generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "QR code generated successfully.",
                qr_code_url: publicUrl, // Return public URL for the client
                session_id: sessionId,
            };
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return { status: "failure", message: "Failed to generate QR code." };
        }
    }
}

export default QR_Code_Auth;
