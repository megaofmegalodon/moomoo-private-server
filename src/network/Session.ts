import SocketManager from "@network/SocketManager";
import Player from "@utils/Player";
import { WebSocket } from "ws";

export default class Session {
    SocketManager: SocketManager;
    player: Player | undefined;

    constructor(
        private id: string,
        private socket: WebSocket
    ) {
        this.SocketManager = new SocketManager(this.id, socket);
    }

    terminate() {
        return this.socket.terminate();
    }
}