import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const App = () => {
  const [ws, setWs] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedTab, setSelectedTab] = useState("table");
  const [isConnected, setIsConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showMessageBox, setShowMessageBox] = useState(true);
  const [syncedCharts, setSyncedCharts] = useState(true);

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
  const columns = [
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
      // Check for system preference
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
    // Save preference to localStorage
    localStorage.setItem('darkMode', darkMode);
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
      let flag = 0;

      // Check if the data is a Blob
      if (event.data instanceof Blob) {
        console.log("Received a Blob:", event.data);
        flag = 1;
        try {
          // Convert Blob to text
          const text = await event.data.text();
          console.log("Converted Blob to text:", text);

          try {
            // Parse as JSON if possible
            receivedData = JSON.parse(text);
          } catch (error) {
            receivedData = text; // Use raw text if parsing fails
          }
        } catch (error) {
          console.error("Error converting Blob to text:", error);
          return;
        }
      } else {
        const text = event.data;
        // workaround as earlier JSON sent by LTE was not being identified.
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
      
      // Process data for table display
      if (typeof receivedData === "object" && receivedData !== null && flag === 1) {
        // Format DB_TIME for use in charts and tables
        let formattedTime = "Unknown";
        let originalTime = receivedData.DB_TIME;
        const timestamp = new Date().toLocaleTimeString();
        
        if (receivedData.DB_TIME) {
          try {
            const date = new Date(receivedData.DB_TIME);
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
          // If no DB_TIME, use current time
          formattedTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        }
        
        // Update chart data with TSV and TSC values using DB_TIME for x-axis
        setChartData(prevData => {
          const newData = [...prevData, {
            time: formattedTime,
            originalTime: originalTime || new Date().toISOString(),
            TSV: receivedData.TSV || 0,
            TSC: receivedData.TSC || 0
          }];
          
          // Keep only the most recent 50 data points for performance
          return newData.length > 50 ? newData.slice(-50) : newData;
        });
        
        // Update table data
        setTableData(prevData => {
          // Create a new row with all columns
          const newRow = {};
          columns.forEach(col => {
            // Format DB_TIME for cleaner display
            if (col === "DB_TIME" && receivedData[col]) {
              try {
                const date = new Date(receivedData[col]);
                // Format as "YYYY-MM-DD HH:MM:SS"
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
                // Fallback if parsing fails
                newRow[col] = receivedData[col];
              }
            } else {
              newRow[col] = receivedData[col] !== undefined ? receivedData[col] : "N/A";
            }
          });
          
          // Add timestamp if not provided
          if (!newRow.DB_timestamp) {
            newRow.DB_timestamp = timestamp;
          }
          
          const updatedData = [...prevData, newRow];
          
          // Limit table to most recent 100 rows for performance
          return updatedData.length > 100 ? updatedData.slice(-100) : updatedData;
        });
      } else if (typeof receivedData === "string") {
        // Handle non-JSON data if needed
        console.log("Received non-JSON data:", receivedData);
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
    // Auto-scroll the table to the bottom when new data arrives
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

  // Toggle dark mode
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
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? "bg-green-400" : "bg-red-500"}`}></span>
              <span>{isConnected ? "Connected" : "Disconnected"}</span>
            </div>
            
            {/* Dark Mode Toggle */}
            <div className="flex items-center">
              <span className="mr-2 text-sm">
                {darkMode ? "🌙" : "☀️"}
              </span>
              <label className="relative inline-block w-12 h-6">
                <input 
                  type="checkbox" 
                  className="opacity-0 w-0 h-0" 
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
                <span className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} transition-all duration-300`}>
                  <span 
                    className={`absolute h-5 w-5 rounded-full bg-white transition-all duration-300 ${darkMode ? 'left-7' : 'left-1'} top-0.5`}>
                  </span>
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
            className={`py-2 px-4 font-medium ${selectedTab === "table" 
              ? (darkMode ? "border-b-2 border-blue-400 text-blue-400" : "border-b-2 border-blue-500 text-blue-600") 
              : (darkMode ? "text-gray-400" : "text-gray-500")}`}
            onClick={() => setSelectedTab("table")}
          >
            Data Table
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
          {/* Table View */}
          {selectedTab === "table" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Real-time Data</h2>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={autoScroll} 
                      onChange={() => setAutoScroll(!autoScroll)}
                      className="mr-2"
                    />
                    Auto-scroll
                  </label>
                </div>
              </div>

              <div id="table-container" className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                <table className="min-w-full border-collapse">
                  <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} sticky top-0 z-10`}>
                    <tr>
                      {columns.map(column => (
                      <th
                        key={column}
                        className={`px-3 py-2 text-xs font-medium ${darkMode ? 'text-gray-200' : 'text-gray-500'} uppercase tracking-wider border ${darkMode ? 'border-gray-600' : 'border-gray-200'} truncate`}
                        title={column} // Add tooltip with full column name
                        style={{ maxWidth: column === "ID" ? "60px" : column === "DB_TIME" ? "120px" : "100px" }}
                      >
                        {column}
                      </th>
                    ))}
                    </tr>
                  </thead>
                  <tbody className={`${darkMode ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                    {tableData.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 
                        ? (darkMode ? 'bg-gray-800' : 'bg-white') 
                        : (darkMode ? 'bg-gray-700' : 'bg-gray-50')}>
                        {columns.map(column => (
                        <td
                          key={`${rowIndex}-${column}`}
                          className={`px-3 py-2 text-sm border ${darkMode ? 'border-gray-600' : 'border-gray-200'} ${
                            column === "ID" ? "w-16" : ""
                          } ${column === "DB_TIME" ? "whitespace-normal" : ""}
                          `}
                          title={column === "DB_TIME" ? row[column] : ""}
                        >
                          {row[column] !== undefined ? row[column] : "N/A"}
                        </td>
                      ))}
                      </tr>
                    ))}
                    {tableData.length === 0 && (
                      <tr>
                        <td colSpan={columns.length} className={`px-3 py-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Waiting for data...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts View */}
          {selectedTab === "charts" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">TSV & TSC Monitoring</h2>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={syncedCharts} 
                      onChange={() => setSyncedCharts(!syncedCharts)}
                      className="mr-2"
                    />
                    <span>Sync tooltips</span>
                  </label>
                </div>
              </div>
              
              {/* TSV Chart */}
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-2">Tractive System Voltage (TSV)</h3>
                <div className={`h-64 p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={chartData} 
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      syncId={syncedCharts ? "tsData" : null}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#555" : "#ccc"} />
                      <XAxis 
                        dataKey="time" 
                        stroke={darkMode ? "#ccc" : "#666"}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        domain={[0, 410]} 
                        label={{ 
                          value: 'Voltage (V)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fill: darkMode ? "#ccc" : "#666" }
                        }} 
                        stroke={darkMode ? "#ccc" : "#666"}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="TSV" 
                        stroke="#8884d8" 
                        name="TSV (Voltage)" 
                        dot={{ stroke: '#8884d8', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* TSC Chart */}
              <div>
                <h3 className="text-lg font-medium mb-2">Tractive System Current (TSC)</h3>
                <div className={`h-64 p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={chartData} 
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      syncId={syncedCharts ? "tsData" : null}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#555" : "#ccc"} />
                      <XAxis 
                        dataKey="time" 
                        stroke={darkMode ? "#ccc" : "#666"}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        label={{ 
                          value: 'Current (A)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fill: darkMode ? "#ccc" : "#666" }
                        }} 
                        stroke={darkMode ? "#ccc" : "#666"}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="TSC" 
                        stroke="#82ca9d" 
                        name="TSC (Current)" 
                        dot={{ stroke: '#82ca9d', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input area */}
      {showMessageBox && (
        <div className={`container mx-auto p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t`}>
          <div className="flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message"
              className={`flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'border-gray-300 text-gray-700'
              }`}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              className={`${darkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              Send
            </button>
          </div>
        </div>
      )}
      
      {/* Message box toggle */}
      <div className="fixed bottom-4 right-4 z-20">
        <button 
          onClick={() => setShowMessageBox(!showMessageBox)}
          className={`${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100'} 
                    p-2 rounded-full shadow-lg transition-all duration-200 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}
          title={showMessageBox ? "Hide message box" : "Show message box"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${darkMode ? 'text-gray-200' : 'text-gray-700'} transform ${showMessageBox ? 'rotate-180' : ''}`} 
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default App;