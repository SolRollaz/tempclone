// Load environment variables from the .env file
import dotenv from 'dotenv';
import path from 'path';

// Specify the path to .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("Loaded Mongo URI:", process.env.MONGO_URI);
console.log("Current Working Directory:", process.cwd());


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
    console.log(`Authentication API listening on http://127.0.0.1:${PORT}/api/auth`);
    console.log(`Public access via Nginx at https://hyprmtrx.xyz/api/auth`);

});
