// server.js
// Minimal WSS relay for TouchDesigner <-> Chef (Option C)
// Run with:  node server.js
// Requires:  npm i express ws
//-------------------------------------------------------------

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

// Environment vars
const PORT = process.env.PORT || 8080;
const SHARED_TOKEN = process.env.WS_SHARED_TOKEN || "replace-with-a-secret-token";

// Server + WSS
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

// Track clients
const tds = new Set();   // TouchDesigner clients
const uis = new Set();   // Chef admin/frontend clients

function safeSend(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.error("Failed to send:", err);
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("close", () => {
    console.log("Client disconnected");
    tds.delete(ws);
    uis.delete(ws);
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // Basic auth
    if (msg.token !== SHARED_TOKEN) {
      safeSend(ws, { error: "bad token" });
      return;
    }

    // Identify which client type
    if (msg.type === "identify") {
      if (msg.role === "td") {
        tds.add(ws);
        console.log("TD connected");
        safeSend(ws, { command: "hello" });
        return;
      }
      if (msg.role === "ui") {
        uis.add(ws);
        console.log("UI/Admin connected");
        safeSend(ws, { command: "hello" });
        return;
      }
    }

    // Only UI/Admin should send start/stop; relay it to TD
    if (msg.command === "start" || msg.command === "stop") {
      console.log(`Broadcasting ${msg.command} for comedian ${msg.comedianId}`);

      tds.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          safeSend(client, msg);
        }
      });
    }
  });
});

app.get("/", (_req, res) => {
  res.send("Relay OK");
});

server.listen(PORT, () => {
  console.log(`WSS Relay running on port ${PORT}`);
  console.log(`Path: ws://localhost:${PORT}/ws`);
});
