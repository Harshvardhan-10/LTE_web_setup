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

app.use(express.json());

// Buffer to collect data before broadcasting
let dataBuffer = {};
let pendingOperations = 0;

// WebSocket message broadcast
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Function to check if all data is ready and broadcast
function checkAndBroadcast() {
    if (pendingOperations === 0 && Object.keys(dataBuffer).length > 0) {
        console.log("Broadcasting complete data:", dataBuffer);
        broadcast(JSON.stringify(dataBuffer));
        dataBuffer = {}; // Reset buffer
    }
}

function saveMotorData(data) {
    // Handle LEFT motor
    if (data.leftMotor && data.leftMotor.data) {
        const leftQuery = "INSERT INTO motor_data (motor_side, torque_out, torque_cmd, filtered_rpm, i_ist, dc_bus_voltage) VALUES (?, ?, ?, ?, ?, ?)";
        const leftValues = [
            'LEFT', 
            data.leftMotor.data[0], // torque_out
            data.leftMotor.data[1], // torque_cmd
            data.leftMotor.data[2], // filtered_rpm
            data.leftMotor.data[3], // i_ist
            data.leftMotor.data[4]  // dc_bus_voltage
        ];

        db.query(leftQuery, leftValues, (err, result) => {
            if (err) {
                console.error("Failed to insert LEFT motor data into MySQL:", err);
                return;
            }

            console.log("LEFT motor data stored in MySQL:", result);

            // Fetch and broadcast the complete row
            const fetchQuery = "SELECT * FROM motor_data WHERE id = ?";
            db.query(fetchQuery, [result.insertId], (fetchErr, rows) => {
                if (fetchErr) {
                    console.error("Failed to fetch LEFT motor data:", fetchErr);
                    return;
                }

                if (rows.length > 0) {
                    broadcast(JSON.stringify({
                        motor_data: {
                            leftMotor: rows[0]
                        }
                    }));
                }
            });
        });
    }

    // Handle RIGHT motor
    if (data.rightMotor && data.rightMotor.data) {
        const rightQuery = "INSERT INTO motor_data (motor_side, torque_out, torque_cmd, filtered_rpm, i_ist, dc_bus_voltage) VALUES (?, ?, ?, ?, ?, ?)";
        const rightValues = [
            'RIGHT', 
            data.rightMotor.data[0], // torque_out
            data.rightMotor.data[1], // torque_cmd
            data.rightMotor.data[2], // filtered_rpm
            data.rightMotor.data[3], // i_ist
            data.rightMotor.data[4]  // dc_bus_voltage
        ];

        db.query(rightQuery, rightValues, (err, result) => {
            if (err) {
                console.error("Failed to insert RIGHT motor data into MySQL:", err);
                return;
            }

            console.log("RIGHT motor data stored in MySQL:", result);

            // Fetch and broadcast the complete row
            const fetchQuery = "SELECT * FROM motor_data WHERE id = ?";
            db.query(fetchQuery, [result.insertId], (fetchErr, rows) => {
                if (fetchErr) {
                    console.error("Failed to fetch RIGHT motor data:", fetchErr);
                    return;
                }

                if (rows.length > 0) {
                    broadcast(JSON.stringify({
                        motor_data: {
                            rightMotor: rows[0]
                        }
                    }));
                }
            });
        });
    }
}

function saveSensorData(data) {
    // Check if data array exists and has the expected length
    if (!data.data || data.data.length < 8) {
        console.error("Invalid sensor data format or insufficient data points");
        return;
    }

    const query = "INSERT INTO sensor_data (apps1_raw, apps2_raw, bps2_raw, steer_raw, yaw_rate, acc_y, yaw_ang_acc, acc_x) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
        data.data[0], // apps1_raw
        data.data[1], // apps2_raw
        data.data[2], // bps2_raw
        data.data[3], // steer_raw
        data.data[4], // yaw_rate
        data.data[5], // acc_y
        data.data[6], // yaw_ang_acc
        data.data[7]  // acc_x
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Failed to insert data into MySQL(sensor_data):", err);
            return;
        }
        
        console.log("Data stored in MySQL(sensor_data):", result);
        
        // Get the inserted ID
        const insertId = result.insertId;
        
        // Query to get the complete row including the auto-generated timestamp
        const fetchQuery = "SELECT * FROM sensor_data WHERE id = ?";
        db.query(fetchQuery, [insertId], (fetchErr, rows) => {
            if (fetchErr) {
                console.error("Failed to fetch complete data:", fetchErr);
                return;
            }
            
            if (rows.length > 0) {
                // Broadcast the complete data including ID and DB_timestamp
                broadcast(JSON.stringify({ sensor_data: rows[0] }));
            }
        });
    });
}

function saveAMSData(data) {
    // Check if data array exists and has the expected length
    if (!data.data || data.data.length < 12) {
        console.error("Invalid AMS data format or insufficient data points");
        return;
    }

    const query = "INSERT INTO ams_flt (Teensy_time, TSV, TSC, CON_SRC, CON_SRC_IL, TO_AMS_RELAY, PRE_PLAUS, C_PLUS, C_MINUS, C_PLUS_PLAUS, C_MINUS_PLAUS, GT_60V_PLAUS, PRE_MECH) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
        data.time, // This remains as a separate field
        data.data[0],     // TSV
        data.data[1],     // TSC
        data.data[2],     // CON_SRC
        data.data[3],     // CON_SRC_IL
        data.data[4],     // TO_AMS_RELAY
        data.data[5],     // PRE_PLAUS
        data.data[6],     // C_PLUS
        data.data[7],     // C_MINUS
        data.data[8],     // C_PLUS_PLAUS
        data.data[9],     // C_MINUS_PLAUS
        data.data[10],    // GT_60V_PLAUS
        data.data[11]     // PRE_MECH
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Failed to insert data into MySQL(ams_data):", err);
            return;
        }
        
        console.log("Data stored in MySQL(ams_data):", result);
        
        // Get the inserted ID
        const insertId = result.insertId;
        
        // Query to get the complete row including the auto-generated timestamp
        const fetchQuery = "SELECT * FROM ams_flt WHERE id = ?";
        db.query(fetchQuery, [insertId], (fetchErr, rows) => {
            if (fetchErr) {
                console.error("Failed to fetch complete data:", fetchErr);
                return;
            }
            
            if (rows.length > 0) {
                // Broadcast the complete data including ID and DB_timestamp
                broadcast(JSON.stringify({ ams_data: rows[0] }));
            }
        });
    });
}

function getRecentMotorData(ws) {
    const query = "SELECT * FROM motor_data ORDER BY id DESC LIMIT 20";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Failed to fetch historical motor data:", err);
            return;
        }
        
        results.reverse().forEach(row => {
            let message;
            if(row.motor_side === 'LEFT') {
                message = {
                    'leftMotor': row
                };
            } else if(row.motor_side === 'RIGHT') {
                message = {
                    'rightMotor': row
                };
            }
            ws.send(JSON.stringify(message));
        });
    });
}

function getRecentSensorData(ws) {
    const query = "SELECT * FROM sensor_data ORDER BY id DESC LIMIT 10";
    
    db.query(query, (err, results) => {
        if (err) {
            console.error("Failed to fetch historical sensor data:", err);
            return;
        }
        
        results.reverse().forEach(row => {
            const message = {
                sensor_data: row
            };
            ws.send(JSON.stringify(message));
        });
    });
}

// Updated WebSocket connection handler
wss.on("connection", (ws) => {
    console.log("Client connected");
    
    // Send recent AMS data (existing)
    const amsQuery = "SELECT id as ID, DB_TIME, Teensy_time, TSV, TSC, CON_SRC, CON_SRC_IL, TO_AMS_RELAY, PRE_PLAUS, C_PLUS, C_MINUS, C_PLUS_PLAUS, C_MINUS_PLAUS, GT_60V_PLAUS, PRE_MECH FROM ams_flt ORDER BY id DESC LIMIT 50";
    
    db.query(amsQuery, (err, results) => {
        if (err) {
            console.error("Failed to fetch historical AMS data:", err);
        } else if (results.length > 0) {
            results.reverse().forEach(row => {
                ws.send(JSON.stringify({ams_data: row}));
            });
        }
    });
    
    // Send recent motor and sensor data
    getRecentMotorData(ws);
    getRecentSensorData(ws);

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
    keyPath: process.env.AWS_IOT_PRIVATE_KEY,
    certPath: process.env.AWS_IOT_CERTIFICATE,
    caPath: process.env.AWS_IOT_ROOT_CA,
    clientId: `server-2131231`,
    host: process.env.AWS_IOT_ENDPOINT
});

// MQTT Event Handlers
device.on('connect', () => {
    console.log('Connected to AWS IoT Core');
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
        
        // Reset buffer for new data set
        dataBuffer = {};
        pendingOperations = 0;
        
        // Handle different types of data
        if (data.ams) {
            saveAMSData(data.ams);
        }
        
        if (data.motor) {
            saveMotorData(data.motor);
        }
        
        if (data.sensor) {
            saveSensorData(data.sensor);
        }
    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

device.on('error', (err) => {
    console.error('MQTT Connection error:', err);
});

// Updated HTTP POST endpoint
app.post("/data", (req, res) => {
    const data = req.body;
    console.log("Received from LTE module via HTTP POST:", data);

    // Reset buffer for new data set
    dataBuffer = {};
    pendingOperations = 0;

    // Handle different types of data
    if (data.ams) {
        saveAMSData(data.ams);
    }
    
    if (data.motor) {
        saveMotorData(data.motor);
    }
    
    if (data.sensor) {
        saveSensorData(data.sensor);
    }

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