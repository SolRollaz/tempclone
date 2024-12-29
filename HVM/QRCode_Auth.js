import { Core } from "@walletconnect/core";
import { createAppKit } from "@reown/appkit";
import { WalletKit } from "@reown/walletkit";
import { wagmiAdapter } from "@reown/adapters-wagmi";
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

        this.core = this.initializeCore();
        this.walletKit = null;
        this.modal = this.initializeModal();
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

    initializeModal() {
        console.log("Initializing Modal...");
        const modal = createAppKit({
            adapters: [wagmiAdapter], // Add the Wagmi adapter
            networks: [{ id: 1, name: "Ethereum Mainnet" }], // Specify networks
            projectId: "1b54a5d583ce208cc28c1362cdd3d437",
        });

        modal.on("stateChange", (state) => console.log("Modal state changed:", state));
        modal.on("event", (event) => console.log("Modal event:", event));

        return modal;
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
                icons: ["https://hyprmtrx.xyz/favicon.png"],
            },
        });

        console.log("WalletKit initialized successfully.");

        // Log all WalletKit events for debugging
        this.walletKit.on("*", (eventName, payload) => {
            console.log(`Event: ${eventName}`, payload);
        });
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
            const uri = this.walletKit.core.pairing.getPairingUri();

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

    async signMessage(message) {
        try {
            console.log("Signing message...");
            this.modal.open({ view: "Connect" }); // Prompt user to connect wallet
            const { account } = this.modal.getState();
            if (!account) {
                throw new Error("No wallet connected.");
            }

            const signature = await wagmiAdapter.signMessage({ message });
            console.log("Message signed successfully:", signature);

            return { status: "success", signature };
        } catch (error) {
            console.error("Error signing message:", error.message);
            return { status: "failure", message: error.message };
        } finally {
            this.modal.close();
        }
    }
}

export default QR_Code_Auth;
