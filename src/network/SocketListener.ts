import { WebSocket } from "ws";

export default class SocketListener {
    init(ws: WebSocket) {
        ws.on("message", (ev) => { });
        ws.on("close", () => { });
    }
}