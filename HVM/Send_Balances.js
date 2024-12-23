import { WalletClient } from "@stardust-collective/dag4";
import { ethers } from "ethers";
import axios from "axios";
import qrCode from "qrcode"; // QR code generation library
import fs from "fs";
import path from "path";
import SystemConfig from "../systemConfig.js"; // Import SystemConfig for better configurability

console.log("Ethers Module:", ethers);


class Send_Balances {
    constructor() {
        this.systemConfig = new SystemConfig(); // Create an instance of SystemConfig
        this.tokenImagesDir = path.join(__dirname, "/Token_Registry/Token_Images");  // Directory where token logos are stored
        this.baseGameAPIEndpoint = this.systemConfig.getGameAPIBaseUrl(); // Get from SystemConfig (base game API URL)
    }

    // Send balances and token logos to the game via dynamic /[game_name]/auth endpoint
    async sendBalances(user_name, hyprmtrx_wallets, game_name) {
        try {
            // Fetch balances for each wallet
            const balances = await this._getWalletBalances(hyprmtrx_wallets);

            // Fetch token logos for each wallet (if available)
            const tokenLogos = await this._getTokenLogos(hyprmtrx_wallets);

            // Prepare the data to send to the game API
            const gameData = {
                user_name,
                balances,
                tokenLogos,
            };

            // Dynamically create the game API URL based on the game name and append '/auth'
            const gameAPIEndpoint = `${this.baseGameAPIEndpoint}/${game_name}/auth`; // Game API URL

            // Send the data to the game API's /[game_name]/auth endpoint
            const response = await axios.post(gameAPIEndpoint, gameData);

            // Log the response from the game
            console.log("Sent balances and token logos to the game:", response.data);

            return { status: "success", message: "Balances and token logos sent successfully." };
        } catch (error) {
            console.error("Error sending balances and token logos:", error.message);
            return { status: "failure", message: "Failed to send balances and token logos to the game." };
        }
    }

    // Retrieve balances for the user's hyprmtrx wallets
    async _getWalletBalances(hyprmtrx_wallets) {
        const balances = [];

        for (const wallet of hyprmtrx_wallets) {
            // Fetch balance from blockchain based on the wallet network
            const balance = await this._fetchBalance(wallet.address, wallet.network);
            balances.push({
                network: wallet.network,
                balance,
            });
        }

        return balances;
    }

    // Fetch the balance for a specific wallet
    async _fetchBalance(address, network) {
        // Use Infura for Ethereum, Avalanche, BNB, and Base networks
        switch (network) {
            case "ETH":
            case "BNB":
            case "AVAX":
            case "Base":
                return await this._fetchEthereumBalance(address, network);
            case "DAG":
                return await this._fetchDAG4Balance(address); // For DAG4 network (Stargazer wallet)
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }

    // Fetch balance for Ethereum-based networks (ETH, AVAX, BNB, Base) using Infura
    async _fetchEthereumBalance(address, network) {
        try {
            const provider = this._getProviderForNetwork(network); // Get the appropriate Infura provider from SystemConfig
            const balance = await provider.getBalance(address);
            return ethers.utils.formatEther(balance); // Convert balance from wei to ether
        } catch (error) {
            console.error(`Error fetching ${network} balance for address ${address}:`, error.message);
            throw error;
        }
    }

    // Fetch balance from DAG4 network
    async _fetchDAG4Balance(address) {
        try {
            const client = new WalletClient();
            const balance = await client.getBalance(address); // DAG4 balance API call
            return balance; // Return balance (assuming the API returns a number)
        } catch (error) {
            console.error(`Error fetching DAG4 balance for address ${address}:`, error.message);
            throw error;
        }
    }

    // Get the appropriate provider based on the network
    _getProviderForNetwork(network) {
        switch (network) {
            case "ETH":
                return new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/98453e56b3db48f4b199411005d69316");
            case "AVAX":
                return new ethers.JsonRpcProvider("https://avalanche-mainnet.infura.io/v3/98453e56b3db48f4b199411005d69316");
            case "BNB":
                return new ethers.JsonRpcProvider("https://opbnb-mainnet.infura.io/v3/98453e56b3db48f4b199411005d69316");
            case "Base":
                return new ethers.JsonRpcProvider("https://base-mainnet.infura.io/v3/98453e56b3db48f4b199411005d69316");
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }

    // Fetch token logos based on wallet data
    async _getTokenLogos(hyprmtrx_wallets) {
        const tokenLogos = [];

        for (const wallet of hyprmtrx_wallets) {
            const logoUrl = `https://constellationnetwork.io.s3-website.us-west-1.amazonaws.com/currency/v1/l1/public/${wallet.tokenSymbol}_${wallet.network}.png`;

            try {
                // Fetch the logo from the URL (if available)
                const logoData = await axios.get(logoUrl, { responseType: "arraybuffer" });
                const base64Logo = Buffer.from(logoData.data, 'binary').toString('base64');

                tokenLogos.push({
                    network: wallet.network,
                    logo: `data:image/png;base64,${base64Logo}`,  // Embed logo as base64 in the payload
                });
            } catch (error) {
                console.error(`Error fetching token logo for ${wallet.tokenSymbol}_${wallet.network}:`, error.message);
                tokenLogos.push({
                    network: wallet.network,
                    logo: null,  // No logo available for this token
                });
            }
        }

        return tokenLogos;
    }
}

export default Send_Balances;
