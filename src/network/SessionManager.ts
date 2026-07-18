import Session from "@network/Session";
import randString from "@utils/randString";
import { WebSocket } from "ws";

export default class SessionManager {
    private static sessionIdMap = new Map<string, Session>();

    static create(ws: WebSocket) {
        let id = randString();

        while (this.sessionIdMap.has(id))
            id = randString();

        const session = new Session(id, ws);
        this.sessionIdMap.set(id, session);
        return session;
    }

    static terminate(id: string) {
        const session = this.sessionIdMap.get(id);
        if (!session) return;

        this.sessionIdMap.delete(id);
        return session.terminate();
    }
}