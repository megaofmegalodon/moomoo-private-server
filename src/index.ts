import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const server = app.listen(1234, () => console.log("Server listening to port 1234"));
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, stream, head) => {
    wss.handleUpgrade(req, stream, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});