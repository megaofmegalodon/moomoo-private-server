import CommandManager from "@core/CommandManager";
import ObjectManager from "@core/ObjectManager";
import SessionManager from "@network/SessionManager";
import getLeaderboardData from "@utils/getLeaderboardData";
import items, { ListId, WeaponId } from "@utils/items";
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
                setTimeout(() => { this.dispatch(type, data); }, 15); // fake artifical ping
            } catch (e) { }
        });

        socket.on("close", () => {
            const player = PlayerManager.remove(sessionId);
            const players = PlayerManager.players;

            if (player) {
                for (let i = 0; i < players.length; i++) {
                    const other = players[i];

                    if (other !== player && other.sentTo.has(player.socketId)) {
                        const session = SessionManager.get(other.socketId);

                        if (session) {
                            session.send(PacketMap.SERVER_TO_CLIENT.REMOVE_PLAYER, player.socketId);
                            session.send(PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS, player.sid);
                        }
                    }
                }

                ObjectManager.removeAll(player.sid);
            }
        });

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
        setTimeout(() => { this.socket.send(binary); }, 15); // fake artifical ping
    }

    hookEvents() {
        this.on(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, (id) => {
            const session = SessionManager.get(this.sessionId)!;
            const player = session.player;

            if (!player) return;
            if (player.upgradePoints <= 0) return;

            if (id < 16) {
                if (id < 9) {
                    player.weapons[0] = id as WeaponId;

                    if (player.weaponIndex < 9) {
                        player.weaponIndex = id as WeaponId;
                    }
                } else {
                    player.weapons[1] = id as WeaponId;

                    if (player.weaponIndex >= 9) {
                        player.weaponIndex = id as WeaponId;
                    }
                }

                player.upgradePoints--;
                player.upgrAge++;
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, player.weapons, true);
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_UPGRADES, player.upgradePoints, player.upgrAge);
            } else {
                const itemId = id - 16;
                const item = items.list[itemId];

                if (item) {
                    if (item.group) {
                        let groupId = 0;

                        if (item.group.name == "food") groupId = 0;
                        if (item.group.name == "walls") groupId = 1;
                        if (item.group.name == "spikes") groupId = 2;
                        if (item.group.name == "mill") groupId = 3;
                        if (item.group.name == "trap" || item.group.name == "booster") groupId = 4;
                        if (["turret", "blocker", "teleporter", "watchtower"].includes(item.group.name)) groupId = 5;

                        player.items[groupId] = itemId as ListId;
                    }

                    player.upgradePoints--;
                    player.upgrAge++;
                    session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_UPGRADES, player.upgradePoints, player.upgrAge);
                    session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, player.items, false);
                }
            }
        });

        this.on(PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD, (id, isWeapon) => {
            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;

            if (isWeapon) {
                player.buildIndex = -1;
                player.weaponIndex = id as any;
            } else {
                if (player.buildIndex === id) {
                    player.buildIndex = -1;
                } else {
                    player.buildIndex = id;
                }
            }
        });

        this.on(PacketMap.CLIENT_TO_SERVER.JOIN_GAME, (data) => {
            const hasSpawnedBefore = PlayerManager.has(this.sessionId);

            if (hasSpawnedBefore)
                return PlayerManager.get(this.sessionId)!.spawn(data.name);

            const ourPlayer = PlayerManager.create(this.sessionId, data.name);
            SessionManager.get(this.sessionId)!.player = ourPlayer;
            this.send(PacketMap.SERVER_TO_CLIENT.SET_UP_GAME, ourPlayer.sid);
            this.send(PacketMap.SERVER_TO_CLIENT.UPDATE_LEADERBOARD, getLeaderboardData());
        });

        this.on(PacketMap.CLIENT_TO_SERVER.STORE, (buy, id, index) => {
            const session = SessionManager.get(this.sessionId);
            if (!session) return;

            const player = session.player;
            if (!player) return;

            if (buy) {
                player.points -= 10e3;
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYER_VALUE, "points", player.points, true);
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS, false, id, index ? 1 : 0);
                return;
            }

            if (player.changeGear(id, index)) {
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS, true, id, index ? 1 : 0);
            }
        });

        this.on(PacketMap.CLIENT_TO_SERVER.SEND_CHAT, (msg) => {
            const player = SessionManager.get(this.sessionId)!.player;
            const players = PlayerManager.players;
            if (!player) return;

            if (msg.startsWith("!")) CommandManager.process(player, msg);

            for (let i = 0; i < players.length; i++) {
                const other = players[i];
                if (!other) continue;

                if (other.canSee(player) && player.sentTo.has(other.socketId)) {
                    const otherSession = SessionManager.get(other.socketId);
                    if (otherSession) otherSession.send(PacketMap.SERVER_TO_CLIENT.RECEIVE_CHAT, player.sid, msg);
                }
            }
        });

        this.on(PacketMap.CLIENT_TO_SERVER.PING_SOCKET, () => {
            SessionManager.get(this.sessionId)!.send(PacketMap.SERVER_TO_CLIENT.PING_RESPONSE);
        });

        this.on(PacketMap.CLIENT_TO_SERVER.SEND_HIT, (toggle, dir) => {
            const player = SessionManager.get(this.sessionId)!.player;
            if (!player) return;

            if (typeof dir !== "number") dir = 0;
            player.dir = dir

            if (toggle) {
                if (player.buildIndex >= 0) {
                    player.buildItem(items.list[player.buildIndex]);
                } else {
                    player.mouseState = 1;
                }
            } else {
                player.mouseState = 0;
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