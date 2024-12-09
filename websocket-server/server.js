const express = require("express");
const http = require("http");
const WebSocket = require("ws");

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

    // Forward the data to WebSocket clients
    broadcast(JSON.stringify(data));

    res.sendStatus(200); // Respond to LTE module with success
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
