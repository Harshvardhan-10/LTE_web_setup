import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";


// function mapValue(value, inMin, inMax, outMin, outMax) {
//   // Clamp the input to avoid values outside the expected range
//   return ((value - inMin) / (inMax - inMin));
// }

const App = () => {
  const [ws, setWs] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [motorData, setMotorData] = useState({ left: {}, right: {} });
  const [sensorData, setSensorData] = useState({});
  const [amsData, setAmsData] = useState({});
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [isConnected, setIsConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [syncedCharts, setSyncedCharts] = useState(true);
  const [lastUpdate, setLastUpdate] = useState({
    ams: null,
    motor: null,
    sensor: null
  });

  // Reusable Metric Card Component
  const MetricCard = ({ title, value, unit, status = "normal", size = "normal" }) => {
    const statusColors = {
      normal: darkMode ? "border-gray-600 bg-gray-700" : "border-gray-200 bg-white",
      warning: darkMode ? "border-yellow-500 bg-yellow-900" : "border-yellow-400 bg-yellow-50",
      critical: darkMode ? "border-red-500 bg-red-900" : "border-red-400 bg-red-50"
    };

    const textSizes = {
      small: "text-lg",
      normal: "text-2xl",
      large: "text-3xl"
    };

    return (
      <div className={`p-3 rounded-lg border ${statusColors[status]} transition-all duration-200`}>
        <div className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider mb-1`}>
          {title}
        </div>
        <div className={`${textSizes[size]} font-bold ${darkMode ? 'text-white' : 'text-gray-900'} flex items-baseline`}>
          {value !== undefined && value !== null ? value : '--'}
          {unit && <span className={`text-sm ml-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{unit}</span>}
        </div>
      </div>
    );
  };

  // Progress Bar Component
  const ProgressBar = ({ value, max, color = "blue", showPercentage = true }) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    
    return (
      <div className="w-full">
        <div className={`w-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2 mb-1`}>
          <div 
            className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        {showPercentage && (
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} text-right`}>
            {percentage.toFixed(1)}%
          </div>
        )}
      </div>
    );
  };

  // Status Indicator Component
  const StatusIndicator = ({ label, status, lastUpdate }) => {
    const getStatusColor = () => {
      if (!lastUpdate) return "bg-gray-500";
      const timeDiff = Date.now() - new Date(lastUpdate).getTime();
      if (timeDiff > 10000) return "bg-red-500"; // No data for 10+ seconds
      if (timeDiff > 5000) return "bg-yellow-500"; // Stale data 5+ seconds
      return "bg-green-500"; // Fresh data
    };

    return (
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
        <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
      </div>
    );
  };

  // IMU Visualization Component
  const IMUDisplay = ({ yawRate, accelX, accelY, yawAngularAccel }) => {
    return (
      <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
        <h3 className={`text-lg font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>IMU Data</h3>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Yaw Rate: <span className="font-mono">{yawRate?.toFixed(2) || '--'}</span> °/s
          </div>
          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Yaw Ang Accel: <span className="font-mono">{yawAngularAccel?.toFixed(2) || '--'}</span> °/s²
          </div>
          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Accel X: <span className="font-mono">{accelX?.toFixed(2) || '--'}</span> m/s²
          </div>
          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Accel Y: <span className="font-mono">{accelY?.toFixed(2) || '--'}</span> m/s²
          </div>
        </div>

        {/* Visual representation of acceleration */}
        <div className="flex justify-center">
          <div className="relative w-24 h-24">
            <div className={`absolute inset-0 border-2 rounded-full ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Center dot */}
                <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></div>
                
                {/* Acceleration vectors */}
                {accelX && (
                  <div 
                    className={`absolute top-1 w-0.5 ${accelX > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{
                      height: `${Math.abs(accelX) * 10}px`,
                      left: '3px',
                      transform: accelX > 0 ? 'rotate(0deg)' : 'rotate(180deg)',
                      transformOrigin: 'bottom'
                    }}
                  ></div>
                )}
                
                {accelY && (
                  <div 
                    className={`absolute left-1 h-0.5 ${accelY > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{
                      width: `${Math.abs(accelY) * 10}px`,
                      top: '3px',
                      transform: accelY > 0 ? 'rotate(90deg)' : 'rotate(-90deg)',
                      transformOrigin: 'left'
                    }}
                  ></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom tooltip component for synced charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3 rounded ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} shadow-lg`}>
          <p className="font-medium text-sm mb-1">{`Time: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Column definitions for our table
  const ams_columns = [
    "ID", "DB_TIME", "Teensy_time", "TSV", "TSC", 
    "CON_SRC", "CON_SRC_IL", "TO_AMS_RELAY", "PRE_PLAUS", 
    "C_PLUS", "C_MINUS", "C_PLUS_PLAUS", "C_MINUS_PLAUS", 
    "GT_60V_PLAUS", "PRE_MECH"
  ];

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      setDarkMode(savedMode === 'true');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useEffect(() => {
    const websocket = new WebSocket(process.env.REACT_APP_WEBSOCKET_URL || "ws://localhost:8080");

    websocket.onopen = () => {
      console.log("WebSocket connection established");
      setIsConnected(true);
    };

    websocket.onclose = () => {
      setIsConnected(false);
    };

    websocket.onmessage = async (event) => {
      let receivedData;
      let amsData, sensorData;
      let flag = 0;

      // Check if the data is a Blob
      if (event.data instanceof Blob) {
        console.log("Received a Blob:", event.data);
        flag = 1;
        try {
          const text = await event.data.text();
          console.log("Converted Blob to text:", text);
          try {
            receivedData = JSON.parse(text);
          } catch (error) {
            receivedData = text;
          }
        } catch (error) {
          console.error("Error converting Blob to text:", error);
          return;
        }
      } else {
        const text = event.data;
        if (text.slice(-1) === '}') {
          console.log("Probably received JSON:", event.data);
          try {
            receivedData = JSON.parse(text);
            flag = 1;
          } catch (error) {
            receivedData = text;
            flag = 0;
            console.log("NOT JSON:", text);
          }
        } else {
          receivedData = text;
          flag = 0;
        }
      }

      console.log("Parsed data:", receivedData);
      console.log("Full received data structure:", receivedData);
      console.log("Motor data structure:", receivedData.motor_data);
      console.log("Left motor data:", receivedData.motor_data?.leftMotor);
      console.log("Right motor data:", receivedData.motor_data?.rightMotor);
      console.log("Sensor data structure:", receivedData.sensor_data);
      console.log("AMS data structure:", receivedData.ams_data);

      // Process different types of data
      if (typeof receivedData === "object" && receivedData !== null && flag === 1) {
        const now = new Date().toISOString();
        amsData = receivedData.ams_data || {};
        const leftMotorData = receivedData.motor_data?.leftMotor || null;
        const rightMotorData = receivedData.motor_data?.rightMotor || null;
        sensorData = receivedData.sensor_data || {};

        // console.log("Right Motor Data: ", rightMotorData);
        // console.log("Left Motor Data: ", leftMotorData);

        // Handle AMS data (existing logic)
        if (amsData.TSV !== undefined || amsData.TSC !== undefined) {
          setAmsData(amsData);
          setLastUpdate(prev => ({ ...prev, ams: now }));

          // Update chart data and table data (existing logic)
          let formattedTime = "Unknown";
          let originalTime = amsData.DB_TIME;
          
          if (amsData.DB_TIME) {
            try {
              const date = new Date(amsData.DB_TIME);
              formattedTime = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
            } catch (error) {
              console.error("Error formatting time:", error);
            }
          } else {
            formattedTime = new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
          }
          
          setChartData(prevData => {
            const newData = [...prevData, {
              time: formattedTime,
              originalTime: originalTime || new Date().toISOString(),
              TSV: amsData.TSV || 0,
              TSC: amsData.TSC || 0
            }];
            return newData.length > 50 ? newData.slice(-50) : newData;
          });
          
          setTableData(prevData => {
            const newRow = {};
            ams_columns.forEach(col => {
              if (col === "DB_TIME" && amsData[col]) {
                try {
                  const date = new Date(amsData[col]);
                  newRow[col] = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  }).replace(',', '');
                } catch (error) {
                  newRow[col] = amsData[col];
                }
              } else {
                newRow[col] = amsData[col] !== undefined ? amsData[col] : "N/A";
              }
            });
            
            const timestamp = new Date().toLocaleTimeString();
            if (!newRow.DB_timestamp) {
              newRow.DB_timestamp = timestamp;
            }
            
            const updatedData = [...prevData, newRow];
            return updatedData.length > 100 ? updatedData.slice(-100) : updatedData;
          });
        }

        // if (leftMotorData || rightMotorData) {
        //   setMotorData({
        //       left: {
        //         ...leftMotorData,
        //         timestamp: leftMotorData.timestamp || now
        //       },
        //       right: {
        //         ...rightMotorData,
        //         timestamp: rightMotorData.timestamp || now
        //       }
        //   });
        //   setLastUpdate(prev => ({ ...prev, motor: now }));
        // }
        // Handle Motor data - UPDATE INDIVIDUAL MOTORS
        if (leftMotorData) {
          console.log("Updating LEFT motor data:", leftMotorData);
          setMotorData(prevData => ({
            ...prevData,
            left: {
              ...leftMotorData,
              timestamp: leftMotorData.timestamp || now
            }
          }));
          setLastUpdate(prev => ({ ...prev, motor: now }));
        }

        if (rightMotorData) {
          console.log("Updating RIGHT motor data:", rightMotorData);
          setMotorData(prevData => ({
            ...prevData,
            right: {
              ...rightMotorData,
              timestamp: rightMotorData.timestamp || now
            }
          }));
          setLastUpdate(prev => ({ ...prev, motor: now }));
        }
        // Handle Sensor data
        if (sensorData.apps1_raw !== undefined || sensorData.yaw_rate !== undefined) {
          setSensorData({
            apps1_raw: sensorData.apps1_raw,
            apps2_raw: sensorData.apps2_raw,
            bps2_raw: sensorData.bps2_raw,
            steer_raw: sensorData.steer_raw,
            yaw_rate: sensorData.yaw_rate,
            accel_x: sensorData.acc_x,
            accel_y: sensorData.acc_y,
            yaw_angular_accel: sensorData.yaw_ang_acc,
            timestamp: sensorData.timestamp || now
          });
          setLastUpdate(prev => ({ ...prev, sensor: now }));
        }
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && tableData.length > 0) {
      const tableContainer = document.getElementById("table-container");
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    }
  }, [tableData, autoScroll]);

  const handleSend = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(input);
      setInput("");
    } else {
      console.error("WebSocket is not open");
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`flex flex-col min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-blue-800' : 'bg-blue-600'} text-white p-4 shadow-md`}>
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">IITB Racing LTE Data Monitor</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4">
              <StatusIndicator label="AMS" lastUpdate={lastUpdate.ams} />
              <StatusIndicator label="Motors" lastUpdate={lastUpdate.motor} />
              <StatusIndicator label="Sensors" lastUpdate={lastUpdate.sensor} />
            </div>
            
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? "bg-green-400" : "bg-red-500"}`}></span>
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
            
            <div className="flex items-center">
              <span className="mr-2 text-sm">{darkMode ? "🌙" : "☀️"}</span>
              <label className="relative inline-block w-12 h-6">
                <input 
                  type="checkbox" 
                  className="opacity-0 w-0 h-0" 
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
                <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} transition-all duration-300`}>
                  <span className={`absolute h-5 w-5 rounded-full bg-white transition-all duration-300 ${darkMode ? 'left-7' : 'left-1'} top-0.5`}></span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto flex-grow p-4">
        {/* Tab navigation */}
        <div className="flex border-b mb-4">
          <button 
            className={`py-2 px-4 font-medium ${selectedTab === "dashboard" 
              ? (darkMode ? "border-b-2 border-blue-400 text-blue-400" : "border-b-2 border-blue-500 text-blue-600") 
              : (darkMode ? "text-gray-400" : "text-gray-500")}`}
            onClick={() => setSelectedTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`py-2 px-4 font-medium ${selectedTab === "table" 
              ? (darkMode ? "border-b-2 border-blue-400 text-blue-400" : "border-b-2 border-blue-500 text-blue-600") 
              : (darkMode ? "text-gray-400" : "text-gray-500")}`}
            onClick={() => setSelectedTab("table")}
          >
            AMS Data Table
          </button>
          <button 
            className={`py-2 px-4 font-medium ${selectedTab === "charts" 
              ? (darkMode ? "border-b-2 border-blue-400 text-blue-400" : "border-b-2 border-blue-500 text-blue-600") 
              : (darkMode ? "text-gray-400" : "text-gray-500")}`}
            onClick={() => setSelectedTab("charts")}
          >
            TSV/TSC Charts
          </button>
        </div>

        {/* Tab content */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-4`}>
          
          {/* Dashboard View */}
          {selectedTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top Status Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="TSV" value={amsData.TSV?.toFixed(1)} unit="V dc" size="large" />
                <MetricCard title="TSC" value={amsData.TSC?.toFixed(1)} unit="A dc" size="large" />
                <MetricCard title="Left RPM" value={motorData.left.filtered_rpm} unit="RPM" />
                <MetricCard title="Right RPM" value={motorData.right.filtered_rpm} unit="RPM" />
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Motor Controllers */}
                <div className="space-y-4">
                  <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Motor Controllers</h2>
                  
                  {/* Left Motor */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Left Motor</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard title="Torque Out" value={motorData.left.torque_out?.toFixed(1)} unit="Nm" size="small" />
                      <MetricCard title="Torque Cmd" value={motorData.left.torque_cmd?.toFixed(1)} unit="Nm" size="small" />
                      <MetricCard title="Current" value={motorData.left.i_ist?.toFixed(2)} unit="A" size="small" />
                      <MetricCard title="DC Bus V" value={motorData.left.dc_bus_voltage?.toFixed(1)} unit="V" size="small" />
                    </div>
                  </div>

                  {/* Right Motor */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Right Motor</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard title="Torque Out" value={motorData.right.torque_out?.toFixed(1)} unit="Nm" size="small" />
                      <MetricCard title="Torque Cmd" value={motorData.right.torque_cmd?.toFixed(1)} unit="Nm" size="small" />
                      <MetricCard title="Current" value={motorData.right.i_ist?.toFixed(2)} unit="A" size="small" />
                      <MetricCard title="DC Bus V" value={motorData.right.dc_bus_voltage?.toFixed(1)} unit="V" size="small" />
                    </div>
                  </div>
                </div>

                {/* Center Column - AMS & Safety */}
                <div className="space-y-4">
                  <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tractive System</h2>
                  
                  {/* TSV/TSC with Progress Bars */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            TSV: {amsData.TSV?.toFixed(1) || '--'} V
                          </span>
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            / 410 V
                          </span>
                        </div>
                        <ProgressBar value={amsData.TSV || 0} max={410} color="blue" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            TSC: {amsData.TSC?.toFixed(1) || '--'} A
                          </span>
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            / 200 A
                          </span>
                        </div>
                        <ProgressBar value={amsData.TSC || 0} max={200} color="green" />
                      </div>
                    </div>
                  </div>

                  {/* Safety Status */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Safety Status</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        { key: 'CON_SRC', label: 'CON SRC' },
                        { key: 'CON_SRC_IL', label: 'CON SRC IL' },
                        { key: 'TO_AMS_RELAY', label: 'AMS Relay' },
                        { key: 'PRE_PLAUS', label: 'Pre Plaus' },
                        { key: 'C_PLUS', label: 'C+' },
                        { key: 'C_MINUS', label: 'C-' },
                        { key: 'C_PLUS_PLAUS', label: 'C+ Plaus' },
                        { key: 'C_MINUS_PLAUS', label: 'C- Plaus' },
                        { key: 'GT_60V_PLAUS', label: '>60V Plaus' },
                        { key: 'PRE_MECH', label: 'Pre Mech' }
                      ].map(item => (
                        <div key={item.key} className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${amsData[item.key] ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Sensors & IMU */}
                <div className="space-y-4">
                  <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Sensors</h2>
                  
                  {/* Pedal Sensors */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Pedal Sensors</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>APPS1</span>
                          <span className={`text-sm font-mono ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {sensorData.apps1_raw || '--'}
                          </span>
                        </div>
                        <ProgressBar value={sensorData.apps1_raw || 0} max={1023} color="purple" showPercentage={true} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>APPS2</span>
                          <span className={`text-sm font-mono ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {sensorData.apps2_raw || '--'}
                          </span>
                        </div>
                        <ProgressBar value={sensorData.apps2_raw || 0} max={1023} color="purple" showPercentage={true} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>BPS2</span>
                          <span className={`text-sm font-mono ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {sensorData.bps2_raw || '--'}
                          </span>
                        </div>
                        <ProgressBar value={sensorData.bps2_raw || 0} max={1023} color="red" showPercentage={true} />
                      </div>
                    </div>
                  </div>

                  {/* Steering */}
                  <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                    <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Steering</h3>
                    <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Raw Value: <span className="font-mono">{sensorData.steer_raw || '--'}</span>
                    </div>
                    <div className="flex justify-center">
                      <div className="relative w-32 h-4 bg-gray-300 rounded-full">
                        <div 
                          className="absolute w-4 h-4 bg-blue-500 rounded-full transition-all duration-300"
                          style={{
                            left: `${Math.max(0, Math.min(100, ((sensorData.steer_raw || 512) - 312) / 400 * 100))}%`,
                            transform: 'translateX(-50%)'
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* IMU Data */}
                  <IMUDisplay 
                    yawRate={sensorData.yaw_rate}
                    accelX={sensorData.accel_x}
                    accelY={sensorData.accel_y}
                    yawAngularAccel={sensorData.yaw_angular_accel}
                  />
                </div>
              </div>

              {/* Bottom Section - Mini Trend Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* RPM Comparison */}
                <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Motor RPM Comparison</h3>
                  <div className="flex justify-between items-center">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {motorData.left.filtered_rpm || '--'}
                      </div>
                      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Left RPM</div>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className={`h-2 ${darkMode ? 'bg-gray-600' : 'bg-gray-200'} rounded-full relative`}>
                        <div 
                          className="h-2 bg-blue-500 rounded-full absolute"
                          style={{ 
                            width: `${Math.abs((motorData.left.filtered_rpm || 0) - (motorData.right.filtered_rpm || 0)) / 100}%`,
                            left: (motorData.left.filtered_rpm || 0) > (motorData.right.filtered_rpm || 0) ? '50%' : 'auto',
                            right: (motorData.left.filtered_rpm || 0) < (motorData.right.filtered_rpm || 0) ? '50%' : 'auto'
                          }}
                        />
                      </div>
                      <div className={`text-xs text-center mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Δ {Math.abs((motorData.left.filtered_rpm || 0) - (motorData.right.filtered_rpm || 0)).toFixed(0)} RPM
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {motorData.right.filtered_rpm || '--'}
                      </div>
                      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Right RPM</div>
                    </div>
                  </div>
                </div>

                {/* APPS Correlation */}
                <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>APPS Correlation</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>APPS1: {sensorData.apps1_raw?.toFixed(0) || '--'}%</span>
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>APPS2: {sensorData.apps2_raw?.toFixed(0) || '--'}%</span>
                    </div>
                    <div className="relative h-16 w-full">
                      <div className={`absolute inset-0 border-2 rounded ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                        <div 
                          className="absolute w-2 h-2 bg-purple-500 rounded-full"
                          style={{
                            left: `${(sensorData.apps1_raw || 0)}%`,
                            bottom: `${(sensorData.apps2_raw || 0)}%`,
                            transform: 'translate(-50%, 50%)'
                          }}
                        />
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                        Correlation: {sensorData.apps1_raw && sensorData.apps2_raw ? 
                          (Math.abs(sensorData.apps1_raw - sensorData.apps2_raw) < 5 ? '✅ Good' : '⚠️ Check') : 
                          '--'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AMS Data Table View */}
          {selectedTab === "table" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  AMS Data Stream ({tableData.length} records)
                </h2>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Auto-scroll to bottom</span>
                </label>
              </div>
              
              <div 
                id="table-container"
                className={`overflow-auto max-h-96 border rounded ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}
              >
                <table className={`min-w-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} sticky top-0`}>
                    <tr>
                      {ams_columns.map((col) => (
                        <th 
                          key={col}
                          className={`px-3 py-2 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider border-r ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`${darkMode ? 'bg-gray-800' : 'bg-white'} divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    {tableData.map((row, index) => (
                      <tr key={index} className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                        {ams_columns.map((col) => (
                          <td 
                            key={col}
                            className={`px-3 py-2 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'} border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                          >
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts View */}
          {selectedTab === "charts" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  TSV/TSC Time Series ({chartData.length} points)
                </h2>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={syncedCharts}
                    onChange={(e) => setSyncedCharts(e.target.checked)}
                    className="mr-2"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Sync chart tooltips</span>
                </label>
              </div>
              
              <div className="space-y-6">
                {/* TSV Chart */}
                <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Tractive System Voltage (TSV)
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="time" 
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <Tooltip 
                        content={syncedCharts ? <CustomTooltip /> : undefined}
                        contentStyle={{
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '6px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="TSV" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        name="TSV (V)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* TSC Chart */}
                <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Tractive System Current (TSC)
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="time" 
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <Tooltip 
                        content={syncedCharts ? <CustomTooltip /> : undefined}
                        contentStyle={{
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '6px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="TSC" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        name="TSC (A)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Combined Chart */}
                <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                  <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    TSV & TSC Combined
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="time" 
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <YAxis 
                        yAxisId="voltage"
                        orientation="left"
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <YAxis 
                        yAxisId="current"
                        orientation="right"
                        stroke={darkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <Tooltip 
                        content={syncedCharts ? <CustomTooltip /> : undefined}
                        contentStyle={{
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '6px'
                        }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="voltage"
                        type="monotone" 
                        dataKey="TSV" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        name="TSV (V)"
                      />
                      <Line 
                        yAxisId="current"
                        type="monotone" 
                        dataKey="TSC" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        name="TSC (A)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;