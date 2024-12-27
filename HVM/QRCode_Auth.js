import { hashMessage, verifyMessage } from "ethers";
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
     * Generate a QR code for MetaMask authentication.
     * @param {string} game_name - Name of the game.
     * @param {string} auth_type - Type of authentication ("metamask").
     * @returns {object} - QR code generation result.
     */
    async generateQRCode(game_name, auth_type) {
        if (!auth_type || auth_type.toLowerCase() !== "metamask") {
            throw new Error("Invalid auth_type. Must be 'metamask'.");
        }

        try {
            const sessionId = `${game_name}_${auth_type}_${Date.now()}`; // Generate a unique session ID
            const filePath = path.join(this.qrCodeDir, `${sessionId}_qrcode.png`);

            // Verify filePath construction
            if (!filePath || typeof filePath !== "string") {
                throw new Error("File path is invalid or undefined.");
            }
            console.log("Generated file path for QR code:", filePath);

            // Generate the message for MetaMask signing
            const message = `Sign this message to authenticate with HyperMatrix: ${sessionId}`;
            const hashedMessage = hashMessage(message); // Correct usage for ethers v6

            // MetaMask-compatible QR code content
            const qrCodeData = {
                type: "auth_request",         // Define the QR code type
                message,                     // Message for MetaMask signing
                hashed_message: hashedMessage, // Pre-hashed message for verification
                session_id: sessionId,       // Unique session ID
                game_name,                   // Game name
                auth_type,                   // Authentication type
                timestamp: Date.now(),       // Timestamp
            };

            // Verify qrCodeData before generation
            console.log("QR Code Data:", qrCodeData);

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
            const message = `Sign this message to authenticate with HyperMatrix: ${session_id}`;
            const hashedMessage = hashMessage(message);

            console.log("Validating signature...");

            // Authenticate the signature
            const isAuthenticated = await this.authenticateWithMetamask(message, signature, wallet_address);

            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Signature mismatch." };
            }

            return { status: "success", message: "Wallet authenticated successfully." };
        } catch (error) {
            console.error("Error authenticating QR code:", error.message);
            return { status: "failure", message: "Authentication failed." };
        }
    }

    /**
     * Authenticate with MetaMask (signature-based verification).
     * @param {string} message - Message to be verified.
     * @param {string} signature - Signature provided by the user.
     * @param {string} walletAddress - Wallet address to verify.
     * @returns {boolean} - True if the signature is valid, otherwise false.
     */
    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            const signerAddress = verifyMessage(message, signature); // Correct usage for ethers v6
            console.log(`Expected Wallet Address: ${walletAddress}`);
            console.log(`Signer Wallet Address: ${signerAddress}`);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during MetaMask authentication:", error.message);
            return false;
        }
    }
}

export default QR_Code_Auth;
