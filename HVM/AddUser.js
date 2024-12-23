import mongoose from "mongoose";
import User from "../Schema/userSchema.js"; // Include the `.js` extension for the schema


class AddUser {
    constructor(systemConfig) {
        this.systemConfig = systemConfig;
    }

    /**
     * This method adds a new user and creates a dynamic collection based on the username
     * @param {string} user_name - The user name of the new user.
     * @param {Array} generatedWallets - List of wallets for the user.
     * @param {string} wallet_address - The main wallet address of the user.
     * @returns {Promise<void>}
     */
    async addNewUser(user_name, generatedWallets, wallet_address) {
        try {
            // Dynamically create a collection based on the user_name
            const userCollectionName = `user_${user_name.toLowerCase()}`; // Ensure collection name is lowercase
            const userSchema = new mongoose.Schema({
                user_name: { type: String, required: true, unique: true },
                auth_wallets: {
                    DAG: { type: String, required: true },
                    AVAX: { type: String, required: true },
                    BNB: { type: String, required: true },
                    ETH: { type: String, required: true },
                },
                hyprmtrx_wallets: [{
                    network: { type: String, required: true },
                    address: { type: String, required: true },
                }],
                created_at: { type: Date, default: Date.now },
            });

            // Create the model dynamically based on the collection name
            const DynamicUserModel = mongoose.model(userCollectionName, userSchema);

            // Extract wallet addresses for the user
            const authWallets = {
                DAG: generatedWallets.find(w => w.network === "DAG").address,
                AVAX: generatedWallets.find(w => w.network === "AVAX").address,
                BNB: generatedWallets.find(w => w.network === "BNB").address,
                ETH: generatedWallets.find(w => w.network === "ETH").address,
            };

            // Create the new user data object
            const user = new DynamicUserModel({
                user_name,
                auth_wallets: authWallets,
                hyprmtrx_wallets: generatedWallets.map(wallet => ({
                    network: wallet.network,
                    address: wallet.address
                })),
            });

            // Save the new user to the database in the dynamically created collection
            await user.save();
            console.log("New user added to collection:", user_name);
        } catch (error) {
            console.error("Error adding user:", error.message);
            throw new Error("Failed to add user.");
        }
    }
}

export default AddUser;
