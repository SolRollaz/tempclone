import dag4 from "@stardust-collective/dag4";
const { WalletClient } = dag4;

import { ethers } from "ethers";
import axios from "axios";
import qrCode from "qrcode"; // QR code generation library
import fs from "fs";
import path from "path";
import WalletManager from "./WalletManager.js"; // Import WalletManager to generate internal wallets

console.log("Ethers Module:", ethers);


class QR_Code_Auth {
    constructor() {
        this.walletClient = new WalletClient();
        this.walletManager = new WalletManager(); // Initialize WalletManager
        this.qrCodeDir = path.join(__dirname, "..", "QR_Codes"); // Directory for storing QR code images

        // Ensure the QR code directory exists
        this.ensureQRCodeDirectory();
    }

    // Ensures the QR code directory exists
    ensureQRCodeDirectory() {
        try {
            if (!fs.existsSync(this.qrCodeDir)) {
                fs.mkdirSync(this.qrCodeDir, { recursive: true });
            }
        } catch (error) {
            console.error("Error creating QR code directory:", error.message);
            throw error;
        }
    }

    // Process the QR code authentication after successful wallet authentication
    async processQRCodeAuth(game_name, user_data, auth_type) {
        try {
            // 1. Authenticate the wallet based on the wallet type (DAG or Metamask)
            const isAuthenticated = await this.authenticateWallet(auth_type, user_data);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed." };
            }

            // 2. Generate and store HyprMtrx wallets (internal wallets)
            const generatedWallets = await this.walletManager.generateHyprmtrxWallets(user_data);

            // 3. Generate or retrieve a QR code file
            const qrCodePath = await this.generateQRCodeFile(game_name, user_data, generatedWallets);

            // 4. Send the QR code to the game API for display
            const gameApiResponse = await this.sendQRCodeToGame(game_name, qrCodePath);

            return gameApiResponse; // Send back response from the game API
        } catch (error) {
            console.error("Error processing QR code authentication:", error.message);
            return { status: "failure", message: "Internal server error during QR code authentication." };
        }
    }

    // Authenticate the wallet (either Metamask or Stargazer)
    async authenticateWallet(auth_type, user_data) {
        try {
            if (auth_type === "stargazer") {
                return await this.walletClient.validateAddress(user_data.DAG); // Validate with DAG4
            } else if (auth_type === "metamask") {
                const message = `Sign this message to authenticate with HyperMatrix: ${user_data.wallet_address} - ${Date.now()}`;
                return await this.authenticateWithMetamask(message, user_data.signature, user_data.wallet_address);
            }
            throw new Error("Unsupported authentication type.");
        } catch (error) {
            console.error("Error during wallet authentication:", error.message);
            return false;
        }
    }

    // Authenticate with Metamask (signature-based verification)
    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            const signerAddress = ethers.utils.verifyMessage(message, signature);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during Metamask authentication:", error.message);
            return false;
        }
    }

    // Generate or retrieve a QR code file for the game
    async generateQRCodeFile(game_name, user_data, generatedWallets) {
        try {
            // Determine the file path for the QR code
            const fileName = `${user_data.DAG}_${game_name}_qrcode.png`; // Unique name based on DAG address and game name
            const filePath = path.join(this.qrCodeDir, fileName);

            // Check if the QR code file already exists
            if (fs.existsSync(filePath)) {
                console.log(`QR code already exists: ${filePath}`);
                return filePath; // Return the existing file path
            }

            // Generate QR code data
            const qrCodeData = JSON.stringify({
                game_name,
                user_address: user_data.DAG, // Use the DAG address
                wallet_data: generatedWallets, // Include wallet data (addresses and networks)
            });

            // Generate and save the QR code as an image file
            await qrCode.toFile(filePath, qrCodeData, {
                color: {
                    dark: "#000000", // QR code dark color
                    light: "#ffffff", // QR code light color
                },
            });

            console.log(`QR code generated and saved: ${filePath}`);
            return filePath; // Return the file path
        } catch (error) {
            console.error("Error generating QR code file:", error.message);
            throw new Error("Failed to generate QR code file.");
        }
    }

    // Send the generated QR code file to the game API for display (game can show this to the player)
    async sendQRCodeToGame(game_name, qrCodePath) {
        try {
            const gameApiUrl = `${process.env.GAME_API_BASE_URL || "https://hyp3rmatrix.xyz"}/${game_name}/auth`; // Game API URL

            // Read the QR code file and convert it to Base64
            const qrCodeBase64 = fs.readFileSync(qrCodePath, { encoding: "base64" });

            // Send the QR code as a Base64 string to the game API
            const response = await axios.post(gameApiUrl, {
                qr_code: qrCodeBase64, // Send the QR code
            });

            console.log(`QR code sent to the game: ${response.status}`);
            return { status: "success", message: "QR code sent to game." };
        } catch (error) {
            console.error("Error sending QR code to the game:", error.message);
            throw new Error("Failed to send QR code to the game.");
        }
    }
}

export default QR_Code_Auth;
