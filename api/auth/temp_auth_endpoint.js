import express from "express";
import bodyParser from "body-parser";
import MasterAuth from "../../HVM/MasterAuth.js";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";

class AuthEndpoint {
    constructor() {
        this.app = express();
        this.app.use(bodyParser.json());
        this.masterAuth = new MasterAuth(); // Instance of MasterAuth class
        this.qrCodeAuth = new QR_Code_Auth(); // Instance of QR_Code_Auth class
        this.systemConfig = new SystemConfig(); // Centralized configuration class

        // MongoDB Configuration
        this.mongoUri = this.systemConfig.getMongoUri() || process.env.MONGO_URI; // Fallback to environment variable
        this.dbName = this.systemConfig.getMongoDbName();
        this.client = new MongoClient(this.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        this.setupRoutes(); // Set up routes for authentication
    }

    // Set up the /auth endpoint for authentication
    setupRoutes() {
        this.app.post("/:game_name/auth", async (req, res) => {
            const { user_name, auth_type, user_data, qr_code } = req.body;
            const { game_name } = req.params; // Extract game_name from URL path

            // Handle QR code authentication
            if (qr_code) {
                try {
                    const authResult = await this.qrCodeAuth.processQRCodeAuth(
                        game_name,
                        user_data,
                        auth_type
                    );
                    return res.json(authResult);
                } catch (error) {
                    console.error("Error during QR Code authentication:", error.message);
                    return res.status(500).json({
                        status: "failure",
                        message: "Internal server error during QR code authentication.",
                    });
                }
            }

            // Generate a temporary username if not provided
            const username = user_name || `temp_name#${Math.floor(Math.random() * 100000)}`;

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
                const authResult = await this.masterAuth.processAuthRequest(
                    username,
                    game_name,
                    auth_type,
                    user_data
                );

                if (authResult.status === "success") {
                    return res.json({
                        status: "success",
                        message: `Welcome ${username}! Authentication successful.`,
                        token: authResult.token,
                        walletData: authResult.walletData,
                    });
                } else {
                    return res.status(401).json(authResult); // Return failure message from MasterAuth
                }
            } catch (error) {
                console.error("Error during authentication:", error.message);
                return res.status(500).json({
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
     * Connect to MongoDB.
     */
    async connectToDB() {
        try {
            if (!this.client.topology?.isConnected()) {
                await this.client.connect();
                console.log("Connected to MongoDB");
            }
        } catch (error) {
            console.error("MongoDB connection error:", error.message);
            throw error;
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

export default AuthEndpoint;
