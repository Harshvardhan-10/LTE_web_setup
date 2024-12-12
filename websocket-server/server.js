require('dotenv').config();
const express = require("express");
const http = require("http");
const mysql = require("mysql2");
const awsIot = require('aws-iot-device-sdk');

// Database configuration
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
        process.exit(1);
    }
    console.log("Connected to MySQL database");
});

const app = express();
const server = http.createServer(app);

app.use(express.json()); // Middleware to parse JSON bodies

// AWS IoT Device Configuration
const device = awsIot.device({
    keyPath: process.env.AWS_IOT_KEY_PATH, // Path to private key
    certPath: process.env.AWS_IOT_CERT_PATH, // Path to device certificate
    caPath: process.env.AWS_IOT_CA_PATH, // Path to root CA certificate
    clientId: process.env.AWS_IOT_CLIENT_ID, // Unique client ID for your device
    host: process.env.AWS_IOT_ENDPOINT, // AWS IoT endpoint
});

// AWS IoT Events
device.on('connect', () => {
    console.log('Connected to AWS IoT Core');
    device.subscribe('lte/data'); // Subscribe to the topic where LTE module sends data
});

device.on('message', (topic, payload) => {
    console.log(`Message received on topic ${topic}: ${payload.toString()}`);
    const data = JSON.parse(payload.toString()); // Parse the incoming message

    // Save data to the database
    const query = "INSERT INTO LTEdata (field1, field2, field3, field4, field5, field6, field7, field8, field9, field10) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [data.field1, data.field2, data.field3, data.field4, data.field5, data.field6, data.field7, data.field8, data.field9, data.field10];

    db.query(query, values, (err, result) => {
        if (err) {
            return console.error("Failed to insert data into MySQL:", err);
        }
        console.log("Data stored in MySQL:", result);
    });
});

// HTTP POST endpoint (optional, can still be used if needed)
app.post("/data", (req, res) => {
    const data = req.body; // Assume the POST body contains JSON data
    console.log("Received from LTE module (HTTP):", data);

    // Save the data to the database
    const query = "INSERT INTO LTEdata (field1, field2, field3, field4, field5, field6, field7, field8, field9, field10) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [data.field1, data.field2, data.field3, data.field4, data.field5, data.field6, data.field7, data.field8, data.field9, data.field10];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Failed to insert data into MySQL:", err);
            return res.status(500).send("Failed to store data");
        }
        console.log("Data stored in MySQL (HTTP):", result);
        res.sendStatus(200); // Respond to LTE module with success
    });
});

// Start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
