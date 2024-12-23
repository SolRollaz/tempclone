// Import the AuthEndpoint class
import AuthEndpoint from './temp_auth_endpoint.js'; // Include `.js` extension in ES modules
import express from 'express'; // Use `import` for consistency in ES modules

// Create an Express app
const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Create an instance of the AuthEndpoint class
const authAPI = new AuthEndpoint();

// Define the API route
app.post('/api/auth', (req, res) => {
    authAPI.handleRequest(req, res); // Delegate to the AuthEndpoint handler
});

// Define the port for the API
const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000

// Start the server
app.listen(PORT, () => {
    console.log(`Authentication API running at http://localhost:${PORT}/hpmx_sandbox/Authentication`);
});
