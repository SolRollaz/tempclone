import { Core } from "@walletconnect/core";
import { WalletKit } from "@reown/walletkit";
import express from "express";

const app = express();
const port = 5000;

app.use(express.json());

// Initialize WalletConnect Core
const core = new Core({
    projectId: "bec9f7c9d9bb224ab819cef805c6c9ef", // Replace with your actual WalletConnect Project ID
    relayUrl: "wss://relay.walletconnect.com",
});

let walletKitInstance;
let walletConnectUri;

// Function to initialize WalletKit in Node.js
async function initializeWalletKit() {
    if (!walletKitInstance) {
        console.log("Initializing WalletKit...");

        walletKitInstance = await WalletKit.init({
            core,
            metadata: {
                name: "My Node.js Wallet App",
                description: "A backend WalletConnect implementation using Reown SDK",
                url: "http://localhost:5000/get-uri",
                icons: ["https://yourbackend.com/icon.png"],
            },
        });

        console.log("WalletKit initialized.");
    }
}

// Generate a WalletConnect URI
app.get("/gen", async (req, res) => {
    try {
        await initializeWalletKit();

        console.log("Creating WalletConnect pairing...");

        const { uri, topic } = await walletKitInstance.core.pairing.create({
            methods: ["wc_authRequest"], // Define methods to be used
        });

        console.log(`Generated WalletConnect URI: ${uri}`);
        walletConnectUri = uri; // Store the URI

        res.json({ success: true, uri, topic });
    } catch (error) {
        console.error("Error generating WalletConnect URI:", error);
        res.status(500).json({ success: false, message: "Failed to generate URI", error: error.message });
    }
});

// Retrieve the last generated URI
app.get("/get-uri", (req, res) => {
    if (!walletConnectUri) {
        return res.status(404).json({ success: false, message: "No WalletConnect URI available." });
    }

    res.json({ success: true, uri: walletConnectUri });
});

// Start Express server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
