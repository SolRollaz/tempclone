const { wallet: dagWallet } = require("@stardust-collective/dag4");
const ethers = require("ethers");
const VaultHandler = require("./VaultHandler");
const MongoClient = require("mongodb").MongoClient;
const AddUser = require("./AddUser");
const QRCodeManager = require("./QRCodeManager");
const WalletInitializer = require("./WalletInitializer");

class WalletManager {
  constructor(systemConfig) {
    this.dbClient = new MongoClient(systemConfig.mongoUrl, { useUnifiedTopology: true });
    this.dbName = systemConfig.dbName;
    this.privateKeyCollection = "private_keys";
    this.vaultHandler = new VaultHandler();
    this.addUser = new AddUser(systemConfig);
    this.qrCodeManager = new QRCodeManager();
    this.systemConfig = systemConfig;
    this.dbClient.connect(); // Connect to the database during initialization
  }

  // Close MongoDB connection when done
  async close() {
    await this.dbClient.close();
  }

  // Store encrypted private keys in the database
  async storePrivateKeys(userName, generatedWallets) {
    try {
      const db = this.dbClient.db(this.dbName);

      // Encrypt private keys using VaultHandler
      const encryptedWallets = generatedWallets.map(wallet => ({
        network: wallet.network,
        address: wallet.address,
        encryptedPrivateKey: this.vaultHandler.encrypt(wallet.private_key),
      }));

      // Insert/update encrypted private keys in the database
      await db.collection(this.privateKeyCollection).updateOne(
        { userName },
        { $set: { wallets: encryptedWallets } },
        { upsert: true }
      );
    } catch (error) {
      console.error("Error storing encrypted private keys:", error.message);
      throw new Error("Failed to store private keys.");
    }
  }

  // Retrieve decrypted private keys (use only when necessary)
  async getDecryptedPrivateKeys(userName) {
    try {
      const db = this.dbClient.db(this.dbName);

      // Find the user's document in the database
      const userDocument = await db.collection(this.privateKeyCollection).findOne({ userName });

      if (!userDocument || !userDocument.wallets) {
        throw new Error("No private keys found for this user.");
      }

      // Decrypt the private keys using VaultHandler
      const decryptedWallets = userDocument.wallets.map(wallet => ({
        network: wallet.network,
        address: wallet.address,
        private_key: this.vaultHandler.decrypt(wallet.encryptedPrivateKey),
      }));

      return decryptedWallets;
    } catch (error) {
      console.error("Error retrieving decrypted private keys:", error.message);
      throw new Error("Failed to retrieve private keys.");
    }
  }

  // Generate wallets for multiple networks (Base, DAG, ETH, BNB, AVAX)
  async generateWalletsForNetworks(user_name, wallet_address, networks = ["Base", "DAG", "ETH", "BNB", "AVAX"]) {
    const generatedWallets = [];

    for (let network of networks) {
      switch (network) {
        case "Base":
          generatedWallets.push({
            network,
            address: await this.generateBaseWallet(),
            private_key: await this.generateBasePrivateKey(),
          });
          break;
        case "DAG":
          generatedWallets.push({
            network,
            address: await this.generateDAGWallet(),
            private_key: await this.generateDAGPrivateKey(),
          });
          break;
        case "ETH":
          generatedWallets.push({
            network,
            address: ethers.Wallet.createRandom().address,
            private_key: ethers.Wallet.createRandom().privateKey,
          });
          break;
        case "BNB":
          generatedWallets.push({
            network,
            address: await this.generateBNBWallet(),
            private_key: await this.generateBNBPrivateKey(),
          });
          break;
        case "AVAX":
          generatedWallets.push({
            network,
            address: await this.generateAvaxWallet(),
            private_key: await this.generateAvaxPrivateKey(),
          });
          break;
        default:
          console.warn(`Unsupported network: ${network}`);
      }
    }

    // Store encrypted private keys in the database
    await this.storePrivateKeys(user_name, generatedWallets);

    // Add the user to the database
    await this.addUser.addNewUser(user_name, generatedWallets, wallet_address);

    // Initialize the wallets
    const walletInitializer = new WalletInitializer(user_name);
    await walletInitializer.initializeWallets(generatedWallets);

    // Generate QR codes for the wallets
    await this.qrCodeManager.generateQRCodeForWallets(user_name, generatedWallets);

    return generatedWallets;
  }

  // Generate Base wallet using ethers.js
  async generateBaseWallet() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }

  async generateBasePrivateKey() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.privateKey;
  }

  // Generate DAG wallet using dag4.wallet
  async generateDAGWallet() {
    const wallet = dagWallet.createWallet();
    return wallet.address;
  }

  async generateDAGPrivateKey() {
    const wallet = dagWallet.createWallet();
    return wallet.keyPair.privateKey;
  }

  async generateBNBWallet() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }

  async generateBNBPrivateKey() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.privateKey;
  }

  async generateAvaxWallet() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.address;
  }

  async generateAvaxPrivateKey() {
    const wallet = ethers.Wallet.createRandom();
    return wallet.privateKey;
  }
}

module.exports = WalletManager;
