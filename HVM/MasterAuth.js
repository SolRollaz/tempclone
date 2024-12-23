const AuthValidator = require('./AuthValidator');
const WalletManager = require('./WalletManager');
const QRCodeManager = require('./QRCodeManager');
const MongoDBClient = require('../MongoDBClient');
const JWTManager = require('./JWTManager');
const Send_Balances = require('./Send_Balances');
const SystemConfig = require('../systemConfig'); // Import SystemConfig

class MasterAuth {
    constructor() {
        this.systemConfig = new SystemConfig(); // Centralized configuration instance
        this.authValidator = new AuthValidator(this.systemConfig); // Pass SystemConfig to dependent classes
        this.walletManager = new WalletManager(this.systemConfig); // WalletManager now handles user addition
        this.qrCodeManager = new QRCodeManager(this.systemConfig);
        this.mongoDBClient = new MongoDBClient();
        this.jwtManager = new JWTManager();
        this.sendBalances = new Send_Balances(this.systemConfig); // Send_Balances to send balances
    }

    // Orchestrate all actions (authentication, wallet generation, QR code generation, etc.)
    async processAuthRequest(game_key, user_name, game_name, auth_type, user_data) {
        try {
            // Step 1: Check if the username already exists in the database
            const userExists = await this.checkIfUsernameExists(user_name);
            let token;

            if (userExists) {
                // User is already registered, generate a player token
                token = await this.jwtManager.generateToken(user_name, user_data.auth_wallets, game_name);
                // Send the balances to the game API for the authenticated user
                await this.sendBalances.sendBalances(user_data.wallet_address, user_data.auth_wallets, game_name);
                return { status: "success", message: "User already registered.", token };
            } else {
                // User is not registered, proceed with wallet authentication
                const message = this.generateAuthMessage(user_data.wallet_address);
                return { status: "success", message: "Please sign this message from your wallet.", data: { message } };
            }
        } catch (error) {
            console.error("Error processing authentication request:", error.message);
            return { status: "failure", message: "Internal server error." };
        }
    }

    // Generate a message that the user will sign to authenticate
    generateAuthMessage(wallet_address) {
        const timestamp = Date.now();
        const message = `Sign this message to authenticate with HyperMatrix: ${wallet_address} - ${timestamp}`;
        return message;
    }

    // Check if the username already exists in the database
    async checkIfUsernameExists(user_name) {
        const db = await this.mongoDBClient.connectToDB();
        const usersCollection = db.collection("users");

        // Query to check if the username exists
        const existingUser = await usersCollection.findOne({ user_name });

        return existingUser !== null;  // Return true if username exists
    }

    // Once user signs the message in their wallet, backend verifies the signature
    async verifySignedMessage(wallet_address, signed_message, auth_type, game_name, user_name) {
        try {
            // Step 1: Validate wallet signature
            const isAuthenticated = await this.authValidator.validateWallet(auth_type, wallet_address, signed_message);
            if (!isAuthenticated) {
                return { status: "failure", message: "Wallet authentication failed. Please try again." };
            }

            // Step 2: Check if user already exists
            const userExists = await this.checkIfUsernameExists(user_name);
            let token;

            if (userExists) {
                // If the user exists, generate and return a JWT token
                token = await this.jwtManager.generateToken(user_name, wallet_address, game_name);
                // Send the balances to the game API for the authenticated user
                await this.sendBalances.sendBalances(wallet_address, userExists.auth_wallets, game_name);
                return {
                    status: "success",
                    message: `Welcome back, ${user_name}!`,
                    token,
                    walletData: userExists.auth_wallets,
                };
            }

            // Step 3: Generate new wallets (Hyprmtrx) and store them if user is not registered
            const generatedWallets = await this.walletManager.generateHyprmtrxWallets(user_name, wallet_address);  // Pass user_name to WalletManager for registration

            // Step 4: Generate QR codes for wallets (DAG, ETH, etc.)
            await this.qrCodeManager.generateQRCodeForWallets(wallet_address, generatedWallets);

            // Step 5: Send balances and token logos to the game API
            const balanceResult = await this.sendBalances.sendBalances(wallet_address, generatedWallets, game_name);
            if (balanceResult.status === "failure") {
                return { status: "failure", message: "Failed to send balances and logos to the game." };
            }

            // Step 6: Generate JWT token for new user
            token = await this.jwtManager.generateToken(user_name, generatedWallets, game_name);

            return {
                status: "success",
                message: `Welcome ${user_name}! Wallet authenticated and registered.`,
                token,
                walletData: generatedWallets,
            };
        } catch (error) {
            console.error("Error during signature verification:", error.message);
            return { status: "failure", message: "Internal server error during authentication." };
        }
    }
}

module.exports = MasterAuth;
