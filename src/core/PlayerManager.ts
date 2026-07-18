import ObjectManager from "@core/ObjectManager";
import SessionManager from "@network/SessionManager";
import PacketMap from "@utils/PacketMap";
import Player from "@utils/Player";

export default class PlayerManager {
    static players: Player[] = [];

    private static currentSID = 0;
    private static idMap = new Map<string, Player>();
    private static sidMap = new Map<number, Player>();

    static create(sessionId: string, name: string) {
        const player = new Player(sessionId, this.currentSID, name);

        this.players.push(player);
        this.idMap.set(sessionId, player);
        this.sidMap.set(this.currentSID, player);
        this.currentSID++;

        return player;
    }

    static has(identifier: string | number) {
        if (typeof identifier === "string") return this.idMap.has(identifier);
        return this.sidMap.has(identifier);
    }

    static get(identifier: string | number) {
        if (typeof identifier === "string") return this.idMap.get(identifier);
        return this.sidMap.get(identifier);
    }

    static remove(identifier: string | number) {
        const players = this.players;
        const isString = typeof identifier === "string";

        for (let i = 0, len = players.length; i < len; i++) {
            let found = false;
            const player = players[i];

            if (isString) {
                if (player.socketId === identifier) {
                    found = true;
                }
            } else {
                if (player.sid === identifier) {
                    found = true;
                }
            }

            if (found) {
                this.idMap.delete(player.socketId);
                this.sidMap.delete(player.sid);
                break;
            }
        }
    }

    static postTick() {
        const players = this.players;

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            if (!player) continue;

            const session = SessionManager.get(player.socketId)!;
            const playerData: any[] = [];

            for (let j = 0; j < len; j++) {
                const other = players[j];
                if (!player.canSee(other)) continue;

                if (other.isAlive && !player.sentTo.has(other.socketId)) {
                    player.sentTo.add(other.socketId);
                    session.send(PacketMap.SERVER_TO_CLIENT.ADD_PLAYER, other.getInitData(), other === player);
                    if (other === player) player.grantAllEverything();
                }

                playerData.push(...other.getUpdateData());
            }

            const gameObjectsData: any[] = [];
            const gameObjects = ObjectManager.getObjects(player.position.x, player.position.y);

            for (let i = 0; i < gameObjects.length; i++) {
                const tmpObj = gameObjects[i];
                if (!tmpObj) continue;

                if (!tmpObj.sentTo.has(player.socketId) && tmpObj.visibleToPlayer(player)) {
                    tmpObj.sentTo.add(player.socketId);
                    gameObjectsData.push(tmpObj.sid, tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.scale, tmpObj.type, tmpObj.id, tmpObj.ownerSID);
                }
            }

            session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS, playerData);
            if (gameObjectsData.length) session.send(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT, gameObjectsData);
        }
    }

    static update() {
        const players = this.players;

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            if (!player) continue;
            player.update();
        }
    }
}