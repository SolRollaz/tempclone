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
     * Generate the first QR code to request the user's wallet address.
     * @param {string} game_name - Name of the game.
     * @param {string} auth_type - Type of authentication.
     * @returns {object} - QR code generation result.
     */
    async generateAddressRequestQRCode(game_name, auth_type) {
        if (!auth_type || auth_type.toLowerCase() !== "metamask") {
            throw new Error("Invalid auth_type. Must be 'metamask'.");
        }

        try {
            const sessionId = `${game_name}_${auth_type}_${Date.now()}`;
            const filePath = path.join(this.qrCodeDir, `${sessionId}_request_qrcode.png`);

            const qrCodeData = {
                method: "wallet_scanQRCode",
                params: [],
                session_id: sessionId,
                game_name,
                auth_type,
                timestamp: Date.now(),
            };

            console.log("Generated First QR Code Data (Request Wallet Address):", qrCodeData);

            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`First QR code (wallet request) generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "First QR code (wallet request) generated.",
                qr_code_path: filePath,
                session_id: sessionId,
                auth_type,
            };
        } catch (error) {
            console.error("Error generating first QR code:", error.message);
            return { status: "failure", message: "Failed to generate first QR code." };
        }
    }

    /**
     * Generate the second QR code for authentication.
     * @param {string} wallet_address - The user's wallet address.
     * @param {string} session_id - Session ID from the first step.
     * @returns {object} - QR code generation result.
     */
    async generateAuthenticationQRCode(wallet_address, session_id) {
        if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            throw new Error("Invalid wallet address.");
        }

        try {
            const filePath = path.join(this.qrCodeDir, `${session_id}_auth_qrcode.png`);

            const message = `Sign this message to authenticate: ${session_id}`;
            const qrCodeData = {
                method: "personal_sign",
                params: [message, wallet_address],
                session_id,
                timestamp: Date.now(),
            };

            console.log("Generated Second QR Code Data (Authentication):", qrCodeData);

            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000",
                    light: "#ffffff",
                },
            });

            console.log(`Second QR code (authentication) generated and saved: ${filePath}`);
            return {
                status: "success",
                message: "Second QR code (authentication) generated.",
                qr_code_path: filePath,
                session_id,
            };
        } catch (error) {
            console.error("Error generating second QR code:", error.message);
            return { status: "failure", message: "Failed to generate second QR code." };
        }
    }

    /**
     * Authenticate the scanned QR code using MetaMask.
     * @param {object} user_data - Wallet data for validation.
     * @returns {object} - Authentication result.
     */
    async authenticateQRCode(user_data) {
        try {
            if (!user_data || !user_data.wallet_address || !user_data.signature || !user_data.session_id) {
                throw new Error("Missing required wallet data: wallet_address, signature, or session_id.");
            }

            const { wallet_address, signature, session_id } = user_data;
            const message = `Sign this message to authenticate: ${session_id}`;

            console.log("Validating signature...");
            const signerAddress = await this.ethereum.request({
                method: "personal_sign",
                params: [message, wallet_address],
            });

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

    /**
     * Validate Ethereum address.
     * @param {string} wallet_address - Ethereum wallet address to validate.
     * @returns {boolean} - True if valid, otherwise false.
     */
    validateEthereumAddress(wallet_address) {
        return /^0x[a-fA-F0-9]{40}$/.test(wallet_address);
    }
}

export default QR_Code_Auth;
