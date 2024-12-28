import WalletKit from "@reown/walletkit";
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

        this.ensureQRCodeDirectory();
    }

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

    async generateAuthenticationQRCode(walletAddress) {
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            throw new Error("Invalid wallet address.");
        }

        try {
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sessionId = `session_${uniqueId}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_auth_qrcode.png`);
            const publicUrl = `https://hyprmtrx.xyz/qr-codes/${path.basename(filePath)}`;

            // Initialize Reown WalletKit
            const walletKit = new WalletKit({
                projectId: "1b54a5d583ce208cc28c1362cdd3d437", // Replace with your Reown project ID
                metadata: {
                    name: "HyperMatrix",
                    description: "WEB3 Authentication ~ hyprmtrx Network",
                    url: "https://hyprmtrx.com",
                    icons: ["https://hyprmtrx.com/favicon.ico"],
                },
            });

            // Create a session and get the connection URI
            const { uri } = await walletKit.connect({
                requiredNamespaces: {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"], // Ethereum Mainnet
                        events: [],
                    },
                },
            });

            console.log(`[Session: ${sessionId}] Reown WalletKit URI: ${uri}`);

            // Generate a QR code with the connection URI
            await qrCode.toFile(filePath, uri, {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`[Session: ${sessionId}] QR code generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "QR code generated successfully.",
                qr_code_path: filePath,
                qr_code_url: publicUrl,
                session_id: sessionId,
                walletkit_uri: uri,
            };
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return { status: "failure", message: "Failed to generate QR code." };
        }
    }
}

export default QR_Code_Auth;
