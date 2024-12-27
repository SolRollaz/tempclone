import dag4 from "@stardust-collective/dag4";
import { ethers } from "ethers";
import SystemConfig from "../systemConfig.js";

const { wallet: dagWallet } = dag4;

class AuthValidator {
    constructor() {
        this.dagWallet = dagWallet;
        this.systemConfig = new SystemConfig();
    }

    async authenticateWithDAG4(walletAddress) {
        try {
            if (!walletAddress) throw new Error("Wallet address is required for DAG4 authentication.");

            this.dagWallet.loginWithPrivateKey(""); // Empty private key for validation
            const isValid = this.dagWallet.validateAddress(walletAddress);
            console.log("DAG Wallet validation result:", isValid);
            return isValid;
        } catch (error) {
            console.error("Error during DAG4 authentication:", error.message);
            return false;
        }
    }

    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            if (!message || !signature || !walletAddress) {
                throw new Error("Message, signature, and wallet address are required for Metamask authentication.");
            }

            const signerAddress = ethers.verifyMessage(message, signature);
            console.log("Metamask signer address:", signerAddress);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during Metamask authentication:", error.message);
            return false;
        }
    }

    createAuthenticationMessage(walletAddress) {
        return `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${Date.now()}`;
    }

    async validateWallet(authType, walletAddress, signature, message) {
        try {
            if (!walletAddress) throw new Error("Wallet address is missing.");

            if (authType.toLowerCase() === "metamask") {
                return await this.authenticateWithMetamask(message, signature, walletAddress);
            } else if (authType.toLowerCase() === "stargazer") {
                return await this.authenticateWithDAG4(walletAddress);
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
