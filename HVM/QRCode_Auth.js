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

    async generateQRCode(game_name, auth_type) {
        if (!auth_type || auth_type.toLowerCase() !== "metamask") {
            throw new Error("Invalid auth_type. Must be 'metamask'.");
        }

        try {
            const sessionId = `${game_name}_${auth_type}_${Date.now()}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_qrcode.png`);

            // Minimal payload for testing
            const qrCodeData = {
                method: "personal_sign",
                params: [
                    `Sign this message to authenticate: ${sessionId}`,
                    "0xYourWalletAddressHere", // Replace with test wallet address
                ],
            };

            console.log("Generated QR Code Data:", qrCodeData);

            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`QR code generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "QR code generated.",
                qr_code_path: filePath,
                session_id: sessionId,
                auth_type,
            };
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return { status: "failure", message: "Failed to generate QR code." };
        }
    }

    async authenticateQRCode(user_data) {
        try {
            if (!user_data || !user_data.wallet_address || !user_data.signature || !user_data.session_id) {
                throw new Error("Missing required wallet data: wallet_address, signature, or session_id.");
            }

            const { wallet_address, signature, session_id } = user_data;
            const message = `Sign this message to authenticate: ${session_id}`;

            console.log("Validating signature...");
            const signerAddress = this.ethereum.utils.verifyMessage(message, signature);

            console.log("Signer Address:", signerAddress);
            if (signerAddress.toLowerCase() !== wallet_address.toLowerCase()) {
                return { status: "failure", message: "Wallet authentication failed. Signature mismatch." };
            }

            return { status: "success", message: "Wallet authenticated successfully." };
        } catch (error) {
            console.error("Error authenticating QR code:", error.message);
            return { status: "failure", message: "Authentication failed." };
        }
    }
}

export default QR_Code_Auth;
