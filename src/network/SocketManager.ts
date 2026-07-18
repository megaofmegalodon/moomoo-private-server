import SessionManager from "@network/SessionManager";
import PacketMap, { MOOMOO_CLIENT_TO_SERVER_MAP, MOOMOO_SERVER_TO_CLIENT_MAP } from "@utils/PacketMap";
import { decode, encode } from "msgpack-lite";
import { WebSocket } from "ws";
import PlayerManager from "../core/PlayerManager";

type EventKey = keyof MOOMOO_CLIENT_TO_SERVER_MAP;
type EventCallback<K extends EventKey> = (...args: MOOMOO_CLIENT_TO_SERVER_MAP[K]) => void;

export default class SocketManager {
    private handlers: {
        [K in EventKey]?: EventCallback<K>
    } = {};

    constructor(
        private sessionId: string,
        private socket: WebSocket
    ) {
        socket.on("open", () => {
            this.send(PacketMap.SERVER_TO_CLIENT.IO_INIT, sessionId, 0, "0", 1);
        });

        socket.on("message", (raw, isBinary) => {
            if (!isBinary) return SessionManager.terminate(sessionId);

            try {
                const [type, data] = this.decode(raw);
                this.dispatch(type, data);
            } catch (e) { }
        });

        socket.on("close", () => { });
        this.hookEvents();
    }

    private decode(raw: any) {
        const parsed = decode(new Uint8Array(raw));
        return parsed;
    }

    private on<K extends EventKey>(type: K, callback: EventCallback<K>) {
        (this.handlers as any)[type] = callback;
    }

    private dispatch<K extends keyof MOOMOO_CLIENT_TO_SERVER_MAP>(
        type: K,
        data: unknown
    ) {
        const callback = this.handlers[type];
        if (!callback) return;

        const typedData = data as MOOMOO_CLIENT_TO_SERVER_MAP[K];
        callback(...typedData);
    }

    send<K extends keyof MOOMOO_SERVER_TO_CLIENT_MAP>(type: K, ...data: MOOMOO_SERVER_TO_CLIENT_MAP[K]) {
        if (this.socket.readyState !== WebSocket.OPEN) return;
        const binary = encode([type, data]);
        this.socket.send(binary);
    }

    hookEvents() {
        this.on(PacketMap.CLIENT_TO_SERVER.JOIN_GAME, (data) => {
            const hasSpawnedBefore = PlayerManager.has(this.sessionId);

            if (hasSpawnedBefore)
                return PlayerManager.get(this.sessionId)!.spawn(data.name);

            const ourPlayer = PlayerManager.create(this.sessionId, data.name);
            SessionManager.get(this.sessionId)!.player = ourPlayer;
            this.send(PacketMap.SERVER_TO_CLIENT.SET_UP_GAME, ourPlayer.sid);
        });

        this.on(PacketMap.CLIENT_TO_SERVER.STORE, (buy, id, index) => {
            if (buy) return;

            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;
            player.changeGear(id, index);
        });

        this.on(PacketMap.CLIENT_TO_SERVER.SEND_CHAT, (msg) => {
            const player = SessionManager.get(this.sessionId)!.player;
            const players = PlayerManager.players;
            if (!player) return;

            for (let i = 0; i < players.length; i++) {
                const other = players[i];
                if (!other) continue;

                if (other.canSee(player) && player.sentTo.has(other.socketId)) {
                    SessionManager.get(other.socketId)!.send(PacketMap.SERVER_TO_CLIENT.RECEIVE_CHAT, player.sid, msg);
                }
            }
        });

        this.on(PacketMap.CLIENT_TO_SERVER.SEND_AIM, (angle) => {
            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;
            player.dir = angle;
        });

        this.on(PacketMap.CLIENT_TO_SERVER.MOVE, (angle) => {
            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;
            player.moveDir = angle;
        });

        this.on(PacketMap.CLIENT_TO_SERVER.AUTO_GATHER, () => {
            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;
            player.autoGather = !player.autoGather;
        });
    }
}