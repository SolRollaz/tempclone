require('dotenv').config(); // Load environment variables
const express = require('express');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors'); // For handling cross-origin requests
const helmet = require('helmet'); // For securing HTTP headers

const app = express();
const PORT = process.env.PORT || 3000; // Define the port the server runs on

// Middleware
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(cors()); // Enable CORS
app.use(helmet()); // Secure HTTP headers

// MongoDB Configuration
const mongoUri = process.env.MONGO_URI; // Ensure this is set in your .env
const dbName = process.env.MONGO_DB_NAME || 'hyprmtrx'; // Default DB name
let db; // Global variable to hold the MongoDB connection

/**
 * Connect to MongoDB.
 */
async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1); // Exit if connection fails
    }
}

/**
 * Route: Health Check
 * Description: Verify if the server is running.
 */
app.get('/', (req, res) => {
    res.status(200).send('API is running successfully.');
});

/**
 * Route: Get All Users
 * Description: Retrieve all users from the database.
 */
app.get('/users', async (req, res) => {
    try {
        const usersCollection = db.collection('users');
        const users = await usersCollection.find({}).toArray();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

/**
 * Start the Server
 */
(async () => {
    await connectToMongoDB(); // Connect to MongoDB before starting the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})();
