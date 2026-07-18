import SocketManager from "@network/SocketManager";
import Player from "@utils/Player";
import { WebSocket } from "ws";

export default class Session {
    private SocketManager: SocketManager;
    player: Player | undefined;

    constructor(
        private id: string,
        private socket: WebSocket
    ) {
        this.SocketManager = new SocketManager(this.id, socket);
    }

    get send() {
        return this.SocketManager.send;
    }

    terminate() {
        return this.socket.terminate();
    }
}