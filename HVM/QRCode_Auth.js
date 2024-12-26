import dag4 from "@stardust-collective/dag4";
import { ethers } from "ethers";
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
        this.walletClient = dag4.wallet;
        this.qrCodeDir = path.join(process.cwd(), "QR_Codes");

        // Ensure the QR code directory exists
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
     * Generate a QR code based on the auth_type for a session or game.
     * @param {string} game_name - Name of the game.
     * @param {string} auth_type - Type of authentication ("metamask" or "stargazer").
     * @returns {object} - QR code generation result.
     */
    async generateQRCode(game_name, auth_type) {
        if (!auth_type || !["metamask", "stargazer"].includes(auth_type.toLowerCase())) {
            throw new Error("Invalid auth_type. Must be 'metamask' or 'stargazer'.");
        }

        try {
            const sessionId = `${game_name}_${auth_type}_${Date.now()}`; // Generate a unique session ID
            const filePath = path.join(this.qrCodeDir, `${sessionId}_qrcode.png`);

            // Embed specific data for the auth_type
            const qrCodeData = {
                session_id: sessionId,
                game_name,
                auth_type,
                timestamp: Date.now(),
            };

            // Generate the QR code
            await qrCode.toFile(filePath, JSON.stringify(qrCodeData), {
                color: {
                    dark: "#000000", // QR code dark color
                    light: "#ffffff", // QR code light color
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

    /**
     * Process authentication after QR code is scanned.
     * Wallet data must be validated during this step.
     * @param {object} user_data - Wallet data for validation.
     * @param {string} auth_type - Type of authentication ("metamask" or "stargazer").
     * @returns {object} - Authentication result.
     */
    async authenticateQRCode(user_data, auth_type) {
        try {
            if (!user_data || !user_data.wallet_address || !user_data.signature) {
                throw new Error("Missing required wallet data: wallet_address or signature.");
            }

            // Authenticate the wallet based on the type
            const isAuthenticated = await this.authenticateWallet(auth_type, user_data);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed." };
            }

            return { status: "success", message: "Wallet authenticated successfully." };
        } catch (error) {
            console.error("Error authenticating QR code:", error.message);
            return { status: "failure", message: "Authentication failed." };
        }
    }

    /**
     * Authenticate the wallet (either Metamask or Stargazer).
     * @param {string} auth_type - Type of authentication.
     * @param {object} user_data - User data containing wallet addresses and signature.
     * @returns {boolean} - True if authenticated, otherwise false.
     */
    async authenticateWallet(auth_type, user_data) {
        try {
            if (auth_type === "stargazer") {
                return await this.walletClient.validateAddress(user_data.wallet_address); // Validate with DAG4
            } else if (auth_type === "metamask") {
                const message = `Sign this message to authenticate with HyperMatrix: ${user_data.wallet_address} - ${Date.now()}`;
                return await this.authenticateWithMetamask(message, user_data.signature, user_data.wallet_address);
            }
            throw new Error("Unsupported authentication type: " + auth_type);
        } catch (error) {
            console.error("Error during wallet authentication:", error.message);
            return false;
        }
    }

    /**
     * Authenticate with Metamask (signature-based verification).
     * @param {string} message - Message to be signed.
     * @param {string} signature - Signature provided by the user.
     * @param {string} walletAddress - Wallet address to verify.
     * @returns {boolean} - True if the signature is valid, otherwise false.
     */
    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            const signerAddress = ethers.utils.verifyMessage(message, signature);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during Metamask authentication:", error.message);
            return false;
        }
    }
}

export default QR_Code_Auth;
