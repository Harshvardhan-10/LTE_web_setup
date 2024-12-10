import React, { useState, useEffect } from "react";

const App = () => {
    const [ws, setWs] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    useEffect(() => {
        const websocket = new WebSocket("ws://13.60.20.183:3000");

        websocket.onopen = () => {
            console.log("WebSocket connection established");
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
            }
	    else {
                const text = event.data;
		if(text.slice(-1) === '}'){
			console.log("Probably received JSON:", event.data);
			try {
				receivedData = JSON.parse(text);
				flag = 1;
			} catch(error) {
				receivedData = text;
				flag = 0;
				console.log("NOT JSON:", text);
			}
		}
		else {
			receivedData = text;
			flag = 0;
		}
            }

            console.log("Parsed data:", receivedData);
	    console.log(typeof receivedData); 
            if (typeof receivedData === "object" && receivedData !== null && flag === 1) {
                // If it's an object, format key-value pairs
                setMessages((prev) => [
                    ...prev,
                    Object.entries(receivedData)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n"),
                ]);
            }
	    else {
                // If it's plain text, display as-is
                setMessages((prev) => [...prev, receivedData]);
            }
        };

        websocket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);

    const handleSend = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(input);
            setInput("");
        } else {
            console.error("WebSocket is not open");
        }
    };

    return (
        <div>
            <h1>LTE Data Transmission</h1>
            <textarea
                rows={10}
                cols={50}
                value={messages.join("\n\n")}
                readOnly
            ></textarea>
            <br />
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message"
            />
            <button onClick={handleSend}>Send</button>
        </div>
    );
};

export default App;
