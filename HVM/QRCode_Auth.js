import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import qrCode from "qrcode";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

            // Listen for relay connection events
            this.core.relayer.on("relayer_connect", () => {
                console.log("Relay server connected successfully.");
            });

            this.core.relayer.on("relayer_disconnect", () => {
                console.error("Relay server disconnected. Check your network or relay configuration.");
            });

            this.core.relayer.on("error", (error) => {
                console.error("Relay server encountered an error:", error);
            });

            // Listen for session proposals
            this.walletKit.on("session_proposal", async ({ id, params }) => {
                console.log("Session proposal received:", params);

                // Required namespaces for the session
                const requiredNamespaces = {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"], // Ethereum Mainnet
                        events: ["accountsChanged", "chainChanged"],
                    },
                };

                try {
                    await this.walletKit.approveSession({
                        id,
                        namespaces: requiredNamespaces,
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

            // Step 1: Generate Topic, SymKey, and Expiry
            console.log("Generating pairing details...");
            const topic = crypto.randomBytes(32).toString("hex").toLowerCase();
            const symKey = crypto.randomBytes(32).toString("hex").toLowerCase();
            const relayProtocol = "irn";
            const expiryTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes expiry
            const uri = `wc:${topic}@2?expiryTimestamp=${expiryTimestamp}&relay-protocol=${relayProtocol}&symKey=${symKey}`;

            console.log(`Constructed URI: ${uri}`);

            // Step 2: Pair with the URI
            console.log("Pairing with WalletKit...");
            await this.walletKit.pair({ uri });

            // Step 3: Generate QR Code
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
