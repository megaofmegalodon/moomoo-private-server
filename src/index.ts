import SessionManager from "@network/SessionManager";
import { config } from "dotenv";
import express from "express";
import { WebSocketServer } from "ws";

config({ quiet: true });
const PORT = process.env.PORT || 1234;

const app = express();
const server = app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
    ws.binaryType = "arraybuffer";
    SessionManager.create(ws);
});

server.on("upgrade", (req, stream, head) => {
    wss.handleUpgrade(req, stream, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});