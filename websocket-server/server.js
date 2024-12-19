require('dotenv').config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
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
const wss = new WebSocket.Server({ server });

app.use(express.json()); // Middleware to parse JSON bodies

// WebSocket message broadcast
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Function to save data to MySQL
function saveToDatabase(data) {
    const query = "INSERT INTO LTEdata (field1, field2, field3, field4, field5, field6, field7, field8, field9, field10) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
        data.field1, data.field2, data.field3, data.field4, 
        data.field5, data.field6, data.field7, data.field8, 
        data.field9, data.field10
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Failed to insert data into MySQL:", err);
            return;
        }
        console.log("Data stored in MySQL:", result);
    });
}

// WebSocket server
wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        console.log("Received from WebSocket client:", message);
        broadcast(message);
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// MQTT Connection using aws-iot-device-sdk
const device = awsIot.device({
    keyPath: process.env.AWS_IOT_PRIVATE_KEY,      // Path to private key
    certPath: process.env.AWS_IOT_CERTIFICATE,     // Path to certificate
    caPath: process.env.AWS_IOT_ROOT_CA,           // Path to root CA
    clientId: `server-${Math.random().toString(16).substring(2, 8)}`, // Unique client ID
    host: process.env.AWS_IOT_ENDPOINT             // AWS IoT Core endpoint
});

// MQTT Event Handlers
device.on('connect', () => {
    console.log('Connected to AWS IoT Core');
    // Subscribe to your specific MQTT topic
    device.subscribe('lte-module/data', (err) => {
        if (err) {
            console.error('MQTT Subscription error:', err);
        } else {
            console.log('Subscribed to lte-module/data topic');
        }
    });
});

device.on('message', (topic, payload) => {
    try {
        const data = JSON.parse(payload.toString());
        console.log('Received MQTT data:', data);
        
        // Save to database
        saveToDatabase(data);
        
        // Broadcast to WebSocket clients
        broadcast(JSON.stringify(data));
    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

device.on('error', (err) => {
    console.error('MQTT Connection error:', err);
});

// HTTP POST endpoint (kept as backup)
app.post("/data", (req, res) => {
    const data = req.body;
    console.log("Received from LTE module via HTTP POST:", data);

    // Save to database
    saveToDatabase(data);

    // Forward to WebSocket clients
    broadcast(JSON.stringify(data));

    res.sendStatus(200);
});

// Start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing MQTT connection and server');
    device.end();
    server.close(() => {
        db.end((err) => {
            process.exit(err ? 1 : 0);
        });
    });
});