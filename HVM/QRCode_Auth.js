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

        // Initialize Core
        this.core = new Core({
            projectId: "1b54a5d583ce208cc28c1362cdd3d437", // Your Reown project ID
        });

        this.walletKit = null;
        this.pairingUri = null; // Store the pairing URI
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

            // Listen for session proposals to capture pairing URI
            this.walletKit.on("session_proposal", async ({ id, params }) => {
                const approvedNamespaces = {
                    eip155: {
                        methods: ["personal_sign"],
                        chains: ["eip155:1"], // Ethereum Mainnet
                        events: [],
                    },
                };

                try {
                    // Approve the session and capture the pairing URI
                    const session = await this.walletKit.approveSession({ id, namespaces: approvedNamespaces });
                    this.pairingUri = session.uri; // Store the URI for pairing
                    console.log("Session approved successfully. Pairing URI:", this.pairingUri);
                } catch (error) {
                    console.error("Failed to approve session:", error.message);
                    await this.walletKit.rejectSession({ id, reason: "USER_REJECTED" });
                }
            });

            // Handle authentication requests
            this.walletKit.on("session_authenticate", async (payload) => {
                try {
                    const supportedChains = ["eip155:1"];
                    const supportedMethods = ["personal_sign"];

                    // Populate authentication payload
                    const authPayload = populateAuthPayload({
                        authPayload: payload.params.authPayload,
                        chains: supportedChains,
                        methods: supportedMethods,
                    });

                    const userAddress = "0xYourWalletAddressHere"; // Replace with the user's Ethereum address
                    const message = this.walletKit.formatAuthMessage({
                        request: authPayload,
                        iss: `eip155:1:${userAddress}`,
                    });

                    // Sign the message (use your wallet logic)
                    const signature = await this.signMessage(message);

                    const auth = buildAuthObject(
                        authPayload,
                        {
                            t: "eip191",
                            s: signature,
                        },
                        `eip155:1:${userAddress}`
                    );

                    await this.walletKit.approveSessionAuthenticate({
                        id: payload.id,
                        auths: [auth],
                    });

                    console.log("Authentication approved.");
                } catch (error) {
                    console.error("Failed to authenticate session:", error.message);
                    await this.walletKit.rejectSessionAuthenticate({
                        id: payload.id,
                        reason: getSdkError("USER_REJECTED"),
                    });
                }
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

            // Initiate pairing
            await this.walletKit.pair(); // This will trigger `session_proposal`

            if (!this.pairingUri) {
                throw new Error("Pairing URI not generated.");
            }

            // Generate a QR code with the pairing URI
            await qrCode.toFile(filePath, this.pairingUri, {
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
                walletkit_uri: this.pairingUri,
            };
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return { status: "failure", message: "Failed to generate QR code." };
        }
    }

    async signMessage(message) {
        // Implement your wallet's signing logic here
        console.log("Signing message:", message);
        return "signature-placeholder"; // Replace with actual signature
    }
}

export default QR_Code_Auth;
