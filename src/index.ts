import ObjectManager from "@core/ObjectManager";
import PlayerManager from "@core/PlayerManager";
import ProjectileManager from "@core/ProjectileManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import getLeaderboardData from "@utils/getLeaderboardData";
import PacketMap from "@utils/PacketMap";
import { config } from "dotenv";
import express from "express";
import { WebSocketServer } from "ws";

config({ quiet: true });
const PORT = process.env.PORT || 1234;

const app = express();
const server = app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));
const wss = new WebSocketServer({ noServer: true });

setInterval(() => {
    PlayerManager.update();
    ObjectManager.update();
    ProjectileManager.update();

    PlayerManager.postTick();
}, Configuration.SERVER_UPDATE_SPEED);

function updateLeaderboards() {
    const players = PlayerManager.players;
    const data = getLeaderboardData();

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player) continue;
        const playerSession = SessionManager.get(player.socketId)!;
        playerSession.send(PacketMap.SERVER_TO_CLIENT.UPDATE_LEADERBOARD, data);
    }
}

setInterval(() => {
    updateLeaderboards();
}, 3e3);

wss.on("connection", (ws) => {
    ws.binaryType = "arraybuffer";
    SessionManager.create(ws);
});

server.on("upgrade", (req, stream, head) => {
    wss.handleUpgrade(req, stream, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});