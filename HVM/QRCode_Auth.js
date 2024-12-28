import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
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

        // Initialize Core and WalletKit
        this.core = new Core({
            projectId: "1b54a5d583ce208cc28c1362cdd3d437",
        });

        this.walletKit = null;
    }

    ensureQRCodeDirectory() {
        if (!fs.existsSync(this.qrCodeDir)) {
            fs.mkdirSync(this.qrCodeDir, { recursive: true });
            console.log("QR code directory created.");
        }
    }

    async initializeWalletKit() {
        if (!this.walletKit) {
            this.walletKit = await WalletKit.init({
                core: this.core,
                metadata: {
                    name: "HyperMatrix",
                    description: "WEB3 Authentication ~ hyprmtrx Network",
                    url: "https://hyprmtrx.com",
                    icons: ["https://hyprmtrx.com/favicon.ico"],
                },
            });

            this.walletKit.on("session_proposal", async ({ id, params }) => {
                const approvedNamespaces = {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"],
                        events: [],
                    },
                };

                try {
                    await this.walletKit.approveSession({ id, namespaces: approvedNamespaces });
                } catch (error) {
                    console.error("Failed to approve session:", error.message);
                    await this.walletKit.rejectSession({ id, reason: "USER_REJECTED" });
                }
            });

            this.walletKit.on("session_request", async (event) => {
                console.log("Session request received:", event);
            });
        }
    }

    async generateAuthenticationQRCode() {
        try {
            await this.initializeWalletKit();

            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sessionId = `session_${uniqueId}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_auth_qrcode.png`);
            const publicUrl = `https://hyprmtrx.xyz/qr-codes/${path.basename(filePath)}`;

            // Generate a WalletKit URI
            const { uri } = await this.walletKit.connect({
                requiredNamespaces: {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"], // Ethereum Mainnet
                        events: [],
                    },
                },
            });

            // Pass the URI to pair
            await this.walletKit.pair({ uri });

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
