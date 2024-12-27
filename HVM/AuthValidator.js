import { MetaMaskSDK } from "@metamask/sdk";
import { ethers } from "ethers";
import SystemConfig from "../systemConfig.js";

class AuthValidator {
    constructor() {
        this.systemConfig = new SystemConfig();
        this.metaMaskSDK = new MetaMaskSDK({
            dappMetadata: {
                name: "HyperMatrix",
                description: "Web3 authentication via MetaMask",
                url: "https://hyprmtrx.xyz",
            },
        });
        this.ethereum = this.metaMaskSDK.getProvider();
    }

    /**
     * Authenticate the wallet using MetaMask (signature-based verification).
     * @param {string} message - Message to be signed.
     * @param {string} signature - Wallet signature.
     * @param {string} walletAddress - Wallet address for verification.
     * @returns {boolean} - True if the signature is valid, otherwise false.
     */
    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            if (!message || !signature || !walletAddress) {
                throw new Error("Message, signature, and wallet address are required for MetaMask authentication.");
            }

            const signerAddress = ethers.verifyMessage(message, signature);
            console.log("MetaMask signer address:", signerAddress);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during MetaMask authentication:", error.message);
            return false;
        }
    }

    /**
     * Request MetaMask to sign a message.
     * @param {string} walletAddress - Wallet address of the user.
     * @returns {object|null} - {message, signature} or null if failed.
     */
    async requestSignature(walletAddress) {
        try {
            const message = `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${Date.now()}`;
            console.log("Requesting MetaMask signature for message:", message);

            const signature = await this.ethereum.request({
                method: "personal_sign",
                params: [message, walletAddress],
            });

            console.log("Signed message received:", signature);
            return { message, signature };
        } catch (error) {
            console.error("Error requesting signature from MetaMask:", error.message);
            return null;
        }
    }

    /**
     * Validate the wallet by requesting a signature or verifying it.
     * @param {string} authType - Authentication type.
     * @param {string} walletAddress - Wallet address.
     * @param {string} signature - Wallet signature.
     * @returns {boolean} - True if validated, false otherwise.
     */
    async validateWallet(authType, walletAddress, signature) {
        try {
            if (!walletAddress) throw new Error("Wallet address is missing.");

            if (authType.toLowerCase() === "metamask") {
                if (signature) {
                    const message = `Sign this message to authenticate with HyperMatrix: ${walletAddress}`;
                    return await this.authenticateWithMetamask(message, signature, walletAddress);
                } else {
                    return await this.requestSignature(walletAddress);
                }
            } else {
                console.error("Unsupported authentication type:", authType);
                return false;
            }
        } catch (error) {
            console.error("Error during wallet validation:", error.message);
            return false;
        }
    }
}

export default AuthValidator;
