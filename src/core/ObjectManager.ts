import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import GameObject from "@utils/GameObject";
import PacketMap from "@utils/PacketMap";
import withinDist from "@utils/withinDist";

const riverWidth = 724;

export default class ObjectManager {
    private static readonly riverMinY = (Configuration.MAP_SIZE / 2) - (riverWidth / 2);
    private static readonly riverMaxY = (Configuration.MAP_SIZE / 2) + (riverWidth / 2);

    static gameObjects: GameObject[] = [];

    private static gridMap: Map<number, GameObject[]> = new Map();
    private static chunkSize = 1440;
    private static GAME_OBJECT_SID = 0;

    static add(x: number, y: number, dir: number, scale: number, type: number, id: number, owner?: number) {
        const gameObject = new GameObject(x, y, dir, scale, type, id, owner);
        gameObject.sid = this.GAME_OBJECT_SID;
        this.GAME_OBJECT_SID++;

        this.gameObjects.push(gameObject);

        const key = this.getKey(x, y);
        if (!this.gridMap.has(key)) this.gridMap.set(key, []);
        this.gridMap.get(key)!.push(gameObject);

        return gameObject;
    }

    static getObject(sid: number) {
        const gameObjects = this.gameObjects;

        for (let i = 0; i < gameObjects.length; i++) {
            const gameObject = gameObjects[i];
            if (gameObject && gameObject.sid === sid) return gameObject;
        }

        return undefined;
    }

    private static getKey(x: number, y: number) {
        const cx = (x / this.chunkSize) | 0;
        const cy = (y / this.chunkSize) | 0;

        return (cx << 16) | (cy & 0xFFFF);
    }

    static getObjects(x: number, y: number, objectFilter?: (gameObject: GameObject) => boolean, chunkRadius = 1) {
        const closeObjects: GameObject[] = [];

        const chunkX = (x / this.chunkSize) | 0;
        const chunkY = (y / this.chunkSize) | 0;

        for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
            for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
                const searchKey = ((chunkX + dx) << 16) | ((chunkY + dy) & 0xFFFF);
                const objects = this.gridMap.get(searchKey);

                if (objects && objects.length) {
                    closeObjects.push(...objects);
                }
            }
        }

        return objectFilter ? closeObjects.filter(objectFilter) : closeObjects;
    }

    private static removeObjectFromChunks(gameObject: GameObject | undefined) {
        if (!gameObject) return;

        const key = this.getKey(gameObject.x, gameObject.y);
        const objects = this.gridMap.get(key);

        if (objects) {
            const index = objects.indexOf(gameObject);

            if (index >= 0) {
                const lastIdx = objects.length - 1;
                objects[index] = objects[lastIdx];
                objects.pop();
            }
        }
    }

    static checkItem(x: number, y: number, scale: number, id: number) {
        const gameObjects = this.getObjects(x, y);
        const pos = { x, y };

        for (const gameObject of gameObjects) {
            if (!gameObject) continue;

            const blockS = gameObject.blocker ? gameObject.blocker : gameObject.getScale(1, gameObject.isItem);
            const combinedScale = scale + blockS;

            if (withinDist(pos, gameObject, combinedScale)) {
                return false;
            }
        }

        if (id != 18 && y >= this.riverMinY && y <= this.riverMaxY) {
            return false;
        }

        return true;
    }

    static remove(sid: number) {
        const gameObjects = this.gameObjects;
        const players = PlayerManager.players;

        for (let i = 0; i < gameObjects.length; i++) {
            const gameObject = gameObjects[i];

            if (gameObject && gameObject.sid === sid) {
                this.removeObjectFromChunks(gameObject);
                this.gameObjects.splice(i, 1);

                for (let i = 0; i < players.length; i++) {
                    const player = players[i];

                    if (player && gameObject.sentTo.has(player.socketId)) {
                        const session = SessionManager.get(player.socketId);
                        if (session) session.send(PacketMap.SERVER_TO_CLIENT.KILL_OBJECT, sid);
                    }
                }

                break;
            }
        }
    }

    static removeAll(ownerSID: number) {
        const gameObjects = this.gameObjects;

        for (let i = gameObjects.length - 1; i >= 0; i--) {
            const obj = gameObjects[i];

            if (obj && obj.ownerSID === ownerSID) {
                this.removeObjectFromChunks(obj);
                this.gameObjects.splice(i, 1);
            }
        }
    }

    static update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        for (let i = 0; i < this.gameObjects.length; i++) {
            if (this.gameObjects[i]) this.gameObjects[i].update(dt);
        }
    }
}