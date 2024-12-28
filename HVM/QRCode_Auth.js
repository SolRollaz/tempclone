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

        this.core = new Core({
            projectId: "1b54a5d583ce208cc28c1362cdd3d437", // Replace with your Reown project ID
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
                console.log("Session proposal received:", params);

                // Approve the session with namespaces
                const approvedNamespaces = {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"],
                        events: [],
                    },
                };

                try {
                    await this.walletKit.approveSession({
                        id,
                        namespaces: approvedNamespaces,
                    });
                    console.log("Session approved successfully.");
                } catch (error) {
                    console.error("Failed to approve session:", error.message);
                }
            });

            this.walletKit.on("proposal_expire", ({ id }) => {
                console.log(`Session proposal ${id} expired.`);
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

            // Step 1: Generate Pairing URI
            console.log("Generating pairing URI...");
            const uri = await this.walletKit.createPairing();
            console.log(`Pairing URI generated: ${uri}`);

            // Step 2: Generate QR Code
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

    async connectSession(topic = null) {
        try {
            const requiredNamespaces = {
                eip155: {
                    methods: ["personal_sign"],
                    chains: ["eip155:1"],
                    events: [],
                },
            };

            console.log("Connecting session...");
            await this.walletKit.connect({
                requiredNamespaces,
                topic, // Existing topic or null for new
            });
            console.log("Session connected successfully.");
        } catch (error) {
            console.error("Error connecting session:", error.message);
        }
    }
}

export default QR_Code_Auth;
