import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import { populateAuthPayload } from "@walletconnect/utils";
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

        this.core = this.initializeCore();
        this.walletKit = null;
    }

    ensureQRCodeDirectory() {
        if (!fs.existsSync(this.qrCodeDir)) {
            fs.mkdirSync(this.qrCodeDir, { recursive: true });
            console.log("QR code directory created.");
        }
    }

    initializeCore() {
        console.log("Initializing Core...");
        const core = new Core({
            projectId: "1b54a5d583ce208cc28c1362cdd3d437",
        });

        core.relayer.on("relayer_connect", () => console.log("Connected to relay server."));
        core.relayer.on("relayer_disconnect", () => console.error("Disconnected from relay server."));
        core.relayer.on("error", (error) => console.error("Relay server encountered an error:", error));

        return core;
    }

    async initializeWalletKit() {
        if (this.walletKit) return;

        console.log("Initializing WalletKit...");
        this.walletKit = await WalletKit.init({
            core: this.core,
            metadata: {
                name: "hyprmtrx",
                description: "WEB3 Authentication via HyperMatrix",
                url: "https://hyprmtrx.xyz",
                icons: ["https://hyprmtrx.com/favicon.png"],
            },
        });

        console.log("WalletKit initialized successfully.");

        // Log all WalletKit events for debugging
        this.walletKit.on("*", (eventName, payload) => {
            console.log(`Event: ${eventName}`, payload);
        });

        // Handle session proposals
        this.walletKit.on("session_proposal", async ({ id, params }) => {
            console.log("Session proposal received:", params);

            const supportedChains = ["eip155:1"]; // Ethereum Mainnet
            const supportedMethods = ["personal_sign", "eth_sendTransaction", "eth_signTypedData"];
            const authPayload = populateAuthPayload({
                authPayload: params.authPayload,
                chains: supportedChains,
                methods: supportedMethods,
            });

            console.log("Populated Auth Payload:", authPayload);

            try {
                await this.walletKit.approveSession({
                    id,
                    namespaces: {
                        eip155: {
                            methods: supportedMethods,
                            chains: supportedChains,
                            events: ["accountsChanged", "chainChanged"],
                        },
                    },
                });
                console.log("Session approved successfully.");
            } catch (error) {
                console.error("Failed to approve session:", error.message);
            }
        });

        this.walletKit.on("proposal_expire", ({ id }) => {
            console.warn(`Session proposal ${id} expired.`);
        });

        console.log("WalletKit event listeners added.");
    }

    async generateAuthenticationQRCode() {
        try {
            console.log("Starting QR code generation process...");
            await this.initializeWalletKit();

            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sessionId = `session_${uniqueId}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_auth_qrcode.png`);
            const publicUrl = `https://hyprmtrx.xyz/qr-codes/${path.basename(filePath)}`;

            console.log("Generating pairing details...");
            const topic = crypto.randomBytes(32).toString("hex").toLowerCase();
            const symKey = crypto.randomBytes(32).toString("hex").toLowerCase();
            const relayProtocol = "irn";
            const expiryTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes expiry
            const uri = `wc:${topic}@2?expiryTimestamp=${expiryTimestamp}&relay-protocol=${relayProtocol}&symKey=${symKey}`;

            console.log(`[Session: ${sessionId}] QR Code Data (URI): ${uri}`);
            console.log("Pairing with WalletKit...");
            await this.walletKit.pair({ uri });

            console.log("Generating QR Code...");
            await qrCode.toFile(filePath, uri, {
                color: { dark: "#000000", light: "#ffffff" },
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
