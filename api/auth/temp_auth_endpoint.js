const express = require("express");
const bodyParser = require("body-parser");
const MasterAuth = require("../../HVM/MasterAuth"); // Assuming MasterAuth is in the same directory
const QR_Code_Auth = require("../../HVM/QRCode_Auth"); // Import QR Code Auth class
const SystemConfig = require("../../systemConfig"); // Centralized system configuration
const { MongoClient } = require("mongodb");

class AuthEndpoint {
    constructor() {
        this.app = express();
        this.app.use(bodyParser.json());
        this.masterAuth = new MasterAuth(); // Instance of MasterAuth class
        this.qrCodeAuth = new QR_Code_Auth(); // Instance of QR_Code_Auth class
        this.systemConfig = new SystemConfig(); // Centralized configuration class

        // MongoDB Configuration
        const mongoUri = this.systemConfig.getMongoUri();
        const dbName = this.systemConfig.getMongoDbName();
        this.client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        this.dbName = dbName;

        this.setupRoutes(); // Set up routes for authentication
    }

    // Set up the /auth endpoint for authentication
    setupRoutes() {
        this.app.post("/:game_name/auth", async (req, res) => {
            let { user_name, auth_type, user_data, qr_code } = req.body;
            const { game_name } = req.params; // Extract game_name from URL path

            // If the request is a QR code request, call QR_Code_Auth
            if (qr_code) {
                try {
                    // Authenticate user via QR code method
                    const authResult = await this.qrCodeAuth.processQRCodeAuth(game_name, user_data, auth_type);
                    res.json(authResult);
                    return;
                } catch (error) {
                    console.error("Error during QR Code authentication:", error.message);
                    return res.status(500).json({
                        status: "failure",
                        message: "Internal server error during QR code authentication.",
                    });
                }
            }

            // Generate a temporary username if not provided
            if (!user_name) {
                user_name = `temp_name#${Math.floor(Math.random() * 100000)}`;
            }

            // Validate required fields
            if (!auth_type || !user_data) {
                return res.status(400).json({
                    status: "failure",
                    message: "Authentication type and user data are required.",
                });
            }

            try {
                // Check if the wallet address already exists for any network
                const walletExists = await this.checkIfWalletExists(user_data);
                if (walletExists) {
                    return res.status(400).json({
                        status: "failure",
                        message: "This wallet is already registered with another account.",
                    });
                }

                // Proceed with wallet authentication using MasterAuth
                const authResult = await this.masterAuth.processAuthRequest(user_name, game_name, auth_type, user_data);

                if (authResult.status === "success") {
                    res.json({
                        status: "success",
                        message: `Welcome ${user_name}! Authentication successful.`,
                        token: authResult.token, // Send the JWT token
                        walletData: authResult.walletData,
                    });
                } else {
                    res.status(401).json(authResult); // Return failure message from MasterAuth
                }
            } catch (error) {
                console.error("Error during authentication:", error.message);
                res.status(500).json({
                    status: "failure",
                    message: "Internal server error during authentication.",
                });
            }
        });
    }

    /**
     * Check if a wallet address already exists in the users collection.
     * @param {Object} user_data - The user data containing wallet addresses.
     * @returns {boolean} - True if the wallet exists, otherwise false.
     */
    async checkIfWalletExists(user_data) {
        try {
            await this.connectToDB();
            const { DAG, AVAX, BNB, ETH } = user_data; // Wallet addresses
            const db = this.client.db(this.dbName);
            const usersCollection = db.collection("users");

            // Query to check if any wallet address already exists
            const existingUser = await usersCollection.findOne({
                $or: [
                    { "auth_wallets.DAG": DAG },
                    { "auth_wallets.AVAX": AVAX },
                    { "auth_wallets.BNB": BNB },
                    { "auth_wallets.ETH": ETH },
                ],
            });

            return existingUser !== null;
        } catch (error) {
            console.error("Error checking wallet existence:", error.message);
            throw error;
        }
    }

    /**
     * Connect to MongoDB with connection pooling.
     */
    async connectToDB() {
        if (!this.client.isConnected()) {
            await this.client.connect();
            console.log("Connected to MongoDB");
        }
    }

    /**
     * Start the Express server.
     * @param {number} port - Port number to start the server on.
     */
    startServer(port) {
        this.app.listen(port, () => {
            console.log(`Auth API running on port ${port}`);
        });
    }
}

module.exports = AuthEndpoint;
