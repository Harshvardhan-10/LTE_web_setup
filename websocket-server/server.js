require('dotenv').config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mysql = require("mysql2");

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

// WebSocket server
wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        console.log("Received from WebSocket client:", message);
        // Broadcast message to all connected WebSocket clients
        broadcast(message);
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

// HTTP POST endpoint
app.post("/data", (req, res) => {
    const data = req.body; // Assume the POST body contains JSON data
    console.log("Received from LTE module:", data);

    // Save the data to the database
    const query = "INSERT INTO LTEdata (field1, field2, field3, field4, field5, field6, field7, field8, field9, field10) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [data.field1, data.field2, data.field3, data.field4, data.field5, data.field6, data.field7, data.field8, data.field9, data.field10]; // Replace with your actual column names and values

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Failed to insert data into MySQL:", err);
            return res.status(500).send("Failed to store data");
        }
        console.log("Data stored in MySQL:", result);
        res.sendStatus(200); // Respond to LTE module with success
    });

    // Forward the data to WebSocket clients
    broadcast(JSON.stringify(data));
});

// Start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
