import dag4 from "@stardust-collective/dag4";
const { WalletClient } = dag4;

import { ethers } from "ethers";
import axios from "axios";
import path from "path";
import SystemConfig from "../systemConfig.js"; // Import SystemConfig for better configurability

class Send_Balances {
    constructor(systemConfig) {
        // Ensure SystemConfig is passed and valid
        if (!systemConfig) {
            throw new Error("SystemConfig instance is required to initialize Send_Balances.");
        }
        this.systemConfig = systemConfig;

        // Ensure `getGameAPIBaseUrl` is defined and callable
        if (typeof this.systemConfig.getGameAPIBaseUrl !== "function") {
            throw new Error("SystemConfig is missing the method getGameAPIBaseUrl.");
        }

        // Retrieve the Game API Base URL from SystemConfig
        this.baseGameAPIEndpoint = this.systemConfig.getGameAPIBaseUrl();

        // Validate that the Base URL is not empty or invalid
        if (!this.baseGameAPIEndpoint) {
            throw new Error("Game API base URL is not defined or invalid in SystemConfig.");
        }

        console.log("Game API Base URL being used:", this.baseGameAPIEndpoint);
    }
}


    /**
     * Send balances and token logos to the game API.
     * @param {string} user_name - The user's name.
     * @param {Array} hyprmtrx_wallets - List of user wallets with network and address details.
     * @param {string} game_name - Name of the game for which the balances are being sent.
     * @returns {Object} - Success or failure message.
     */
    async sendBalances(user_name, hyprmtrx_wallets, game_name) {
        try {
            if (!user_name || !hyprmtrx_wallets || !game_name) {
                throw new Error("Invalid input: user_name, hyprmtrx_wallets, and game_name are required.");
            }

            // Fetch balances and token logos
            const balances = await this._getWalletBalances(hyprmtrx_wallets);
            const tokenLogos = await this._getTokenLogos(hyprmtrx_wallets);

            // Construct payload
            const gameData = {
                user_name,
                balances,
                tokenLogos,
            };

            const gameAPIEndpoint = `${this.baseGameAPIEndpoint}/${game_name}/auth`;

            const response = await axios.post(gameAPIEndpoint, gameData);

            console.log("Sent balances and token logos to the game:", response.data);
            return { status: "success", message: "Balances and token logos sent successfully." };
        } catch (error) {
            console.error("Error sending balances and token logos:", error.message);
            return { status: "failure", message: "Failed to send balances and token logos to the game." };
        }
    }

    /**
     * Fetch wallet balances for the provided wallets.
     * @param {Array} hyprmtrx_wallets - List of wallets with network and address details.
     * @returns {Array} - List of wallet balances.
     */
    async _getWalletBalances(hyprmtrx_wallets) {
        const balances = [];
        for (const wallet of hyprmtrx_wallets) {
            try {
                const balance = await this._fetchBalance(wallet.address, wallet.network);
                balances.push({
                    network: wallet.network,
                    balance,
                });
            } catch (error) {
                console.error(`Error fetching balance for wallet (Network: ${wallet.network}, Address: ${wallet.address}):`, error.message);
            }
        }
        return balances;
    }

    /**
     * Fetch the balance for a specific wallet address and network.
     * @param {string} address - Wallet address.
     * @param {string} network - Network type (e.g., ETH, BNB, DAG).
     * @returns {string} - Wallet balance as a string.
     */
    async _fetchBalance(address, network) {
        switch (network) {
            case "ETH":
            case "BNB":
            case "AVAX":
            case "Base":
                return await this._fetchEthereumBalance(address, network);
            case "DAG":
                return await this._fetchDAG4Balance(address);
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }

    /**
     * Fetch balance for Ethereum-based networks.
     */
    async _fetchEthereumBalance(address, network) {
        try {
            const provider = this.systemConfig.getProvider(network); // Use `getProvider` from SystemConfig
            const balance = await provider.getBalance(address);
            return ethers.utils.formatEther(balance); // Convert from wei to ether
        } catch (error) {
            console.error(`Error fetching ${network} balance for address ${address}:`, error.message);
            throw error;
        }
    }

    /**
     * Fetch balance for DAG network.
     */
    async _fetchDAG4Balance(address) {
        try {
            const client = new WalletClient();
            const balance = await client.getBalance(address);
            return balance;
        } catch (error) {
            console.error(`Error fetching DAG balance for address ${address}:`, error.message);
            throw error;
        }
    }

    /**
     * Fetch token logos for provided wallets.
     */
    async _getTokenLogos(hyprmtrx_wallets) {
        const tokenLogos = [];
        for (const wallet of hyprmtrx_wallets) {
            try {
                const logoUrl = `https://constellationnetwork.io.s3-website.us-west-1.amazonaws.com/currency/v1/l1/public/${wallet.tokenSymbol}_${wallet.network}.png`;
                const logoData = await axios.get(logoUrl, { responseType: "arraybuffer" });
                const base64Logo = Buffer.from(logoData.data, "binary").toString("base64");
                tokenLogos.push({
                    network: wallet.network,
                    logo: `data:image/png;base64,${base64Logo}`,
                });
            } catch (error) {
                console.error(`Error fetching logo for ${wallet.tokenSymbol}_${wallet.network}:`, error.message);
                tokenLogos.push({
                    network: wallet.network,
                    logo: null,
                });
            }
        }
        return tokenLogos;
    }
}

export default Send_Balances;
