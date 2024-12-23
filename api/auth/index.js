// Import the AuthEndpoint class
const AuthEndpoint = require("./api/auth/temp_auth_endpoint");

// Create an instance of the AuthEndpoint class
const authAPI = new AuthEndpoint();

// Define the port for the API
const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000

// Start the server
authAPI.startServer(PORT);
