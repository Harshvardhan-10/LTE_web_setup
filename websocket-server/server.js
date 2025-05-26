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

function saveMotorData(data) {
    // Handle LEFT motor
    if (data.leftMotor) {
        const leftQuery = "INSERT INTO motor_data (motor_side, torque_out, torque_cmd, filtered_rpm, i_ist, dc_bus_voltage) VALUES (?, ?, ?, ?, ?, ?)";
        const leftValues = [
            'LEFT', 
            data.leftMotor.torque_out, 
            data.leftMotor.torque_cmd, 
            data.leftMotor.filtered_rpm, 
            data.leftMotor.i_ist, 
            data.leftMotor.dc_bus_voltage
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
    if (data.rightMotor) {
        const rightQuery = "INSERT INTO motor_data (motor_side, torque_out, torque_cmd, filtered_rpm, i_ist, dc_bus_voltage) VALUES (?, ?, ?, ?, ?, ?)";
        const rightValues = [
            'RIGHT', 
            data.rightMotor.torque_out, 
            data.rightMotor.torque_cmd, 
            data.rightMotor.filtered_rpm, 
            data.rightMotor.i_ist, 
            data.rightMotor.dc_bus_voltage
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
    const query = "INSERT INTO sensor_data (apps1_raw, apps2_raw, bps2_raw, steer_raw, yaw_rate, acc_y, yaw_ang_acc, acc_x)\
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
        data.apps1_raw, data.apps2_raw, data.bps2_raw, data.steer_raw, 
        data.yaw_rate, data.acc_y, data.yaw_ang_acc, data.acc_x
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
    const query = "INSERT INTO ams_flt (Teensy_time, TSV, TSC, CON_SRC, CON_SRC_IL, TO_AMS_RELAY, PRE_PLAUS, C_PLUS,\
     C_MINUS, C_PLUS_PLAUS, C_MINUS_PLAUS, GT_60V_PLAUS, PRE_MECH) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const values = [
        data.Teensy_time, data.TSV, data.TSC, data.CON_SRC, data.CON_SRC_IL, data.TO_AMS_RELAY, data.PRE_PLAUS, data.C_PLUS, 
        data.C_MINUS, data.C_PLUS_PLAUS, data.C_MINUS_PLAUS, data.GT_60V_PLAUS, data.PRE_MECH
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
            const message = {
                type: row.motor_side === 'LEFT' ? 'leftMotorUpdate' : 'rightMotorUpdate',
                data: row
            };
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
                type: 'sensorUpdate',
                data: row
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
                ws.send(JSON.stringify(row));
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
    keyPath: process.env.AWS_IOT_PRIVATE_KEY,      // Path to private key
    certPath: process.env.AWS_IOT_CERTIFICATE,     // Path to certificate
    caPath: process.env.AWS_IOT_ROOT_CA,           // Path to root CA
    clientId: `server-2131231`, // Unique client ID
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
        
        // Handle different types of data
        if (data.ams_data) {
            saveAMSData(data.ams_data);
        }
        
        if (data.motor_data) {
            saveMotorData(data.motor_data);
        }
        
        if (data.sensor_data) {
            saveSensorData(data.sensor_data);
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

    // Handle different types of data
    if (data.ams_data) {
        saveAMSData(data.ams_data);
    }
    
    if (data.motor_data) {
        saveMotorData(data.motor_data);
    }
    
    if (data.sensor_data) {
        saveSensorData(data.sensor_data);
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
