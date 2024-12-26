import dag4 from "@stardust-collective/dag4";
const { wallet: dagWallet } = dag4;

import { ethers } from "ethers";
import VaultHandler from "./VaultHandler.js";
import { MongoClient } from "mongodb";
import AddUser from "./AddUser.js";
import QRCodeManager from "./QRCodeManager.js";
import WalletInitializer from "./WalletInitializer.js";

class WalletManager {
    constructor(systemConfig) {
        this.dbClient = new MongoClient(systemConfig.mongoUrl, { useUnifiedTopology: true });
        this.dbName = systemConfig.dbName;
        this.privateKeyCollection = "private_keys";
        this.vaultHandler = new VaultHandler();
        this.addUser = new AddUser(systemConfig);
        this.qrCodeManager = new QRCodeManager();
        this.systemConfig = systemConfig;

        // Connect to the database
        this.dbClient.connect().catch((error) => {
            console.error("Error connecting to MongoDB:", error.message);
            throw new Error("Failed to connect to MongoDB.");
        });
    }

    async close() {
        await this.dbClient.close();
    }

    async storePrivateKeys(userName, generatedWallets) {
        try {
            const db = this.dbClient.db(this.dbName);
            const encryptedWallets = generatedWallets.map(wallet => ({
                network: wallet.network,
                address: wallet.address,
                encryptedPrivateKey: this.vaultHandler.encrypt(wallet.private_key),
            }));

            await db.collection(this.privateKeyCollection).updateOne(
                { userName },
                { $set: { wallets: encryptedWallets } },
                { upsert: true }
            );
        } catch (error) {
            console.error(`Error storing private keys for user: ${userName}`, error.message);
            throw new Error("Failed to store private keys.");
        }
    }

    async getDecryptedPrivateKeys(userName) {
        try {
            const db = this.dbClient.db(this.dbName);
            const userDocument = await db.collection(this.privateKeyCollection).findOne({ userName });

            if (!userDocument || !userDocument.wallets) {
                throw new Error("No private keys found for this user.");
            }

            return userDocument.wallets.map(wallet => ({
                network: wallet.network,
                address: wallet.address,
                private_key: this.vaultHandler.decrypt(wallet.encryptedPrivateKey),
            }));
        } catch (error) {
            console.error(`Error retrieving private keys for user: ${userName}`, error.message);
            throw new Error("Failed to retrieve private keys.");
        }
    }

    async generateWalletsForNetworks(user_name, wallet_address, networks = ["Base", "DAG", "ETH", "BNB", "AVAX"]) {
        if (!user_name || !wallet_address) {
            throw new Error("Invalid input: user_name and wallet_address are required.");
        }
        if (!Array.isArray(networks) || networks.length === 0) {
            throw new Error("Invalid input: networks must be a non-empty array.");
        }

        const generatedWallets = [];
        for (const network of networks) {
            try {
                const wallet = await this._generateWalletForNetwork(network);
                if (wallet) {
                    generatedWallets.push(wallet);
                    console.log(`Generated wallet for network ${network} for user: ${user_name}`);
                }
            } catch (error) {
                console.warn(`Failed to generate wallet for network ${network}:`, error.message);
            }
        }

        await this.storePrivateKeys(user_name, generatedWallets);
        await this.addUser.addNewUser(user_name, generatedWallets, wallet_address);

        const walletInitializer = new WalletInitializer(user_name);
        await walletInitializer.initializeWallets(generatedWallets);

        await this.qrCodeManager.generateQRCodeForWallets(user_name, generatedWallets);

        return generatedWallets;
    }

    async _generateWalletForNetwork(network) {
        switch (network) {
            case "Base":
            case "ETH":
            case "BNB":
            case "AVAX": {
                const wallet = ethers.Wallet.createRandom();
                return { network, address: wallet.address, private_key: wallet.privateKey };
            }
            case "DAG": {
                const wallet = dagWallet.createWallet();
                return { network, address: wallet.address, private_key: wallet.keyPair.privateKey };
            }
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }
}

export default WalletManager;
