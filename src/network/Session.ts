import SocketManager from "@network/SessionManager";
import SocketListener from "@network/SocketListener";
import { WebSocket } from "ws";

export default class Session {
    SocketListener = new SocketListener();

    constructor(
        private id: string,
        private socket: WebSocket
    ) {
        this.SocketListener.init(this.socket);

        socket.on("message", (data, isBinary) => {
            if (!isBinary) return SocketManager.terminate(this.id);
        });
    }

    terminate() {
        return this.socket.terminate();
    }
}