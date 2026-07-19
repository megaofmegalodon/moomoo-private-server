import ObjectManager from "@core/ObjectManager";
import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import GameObject from "@utils/GameObject";
import getDistSq from "@utils/getDistSq";
import items from "@utils/items";
import lineInRect from "@utils/lineInRect";
import PacketMap from "@utils/PacketMap";
import Player from "@utils/Player";

export default class Projectile {
    dmg: number;
    scale: number;
    active = true;
    skipMove = true;

    private sentTo = new Set<string>();

    constructor(
        public sid: number,
        public indx: number,
        public x: number,
        public y: number,
        public dir: number,
        public speed: number,
        public range: number,
        public layer: number,
        public ownerSID: number
    ) {
        const data = items.projectiles[indx];
        this.dmg = data.dmg;
        this.scale = data.scale;
    }

    init(
        indx: number,
        x: number, y: number,
        dir: number,
        speed: number,
        range: number,
        layer: number,
        ownerSID: number
    ) {
        this.sentTo.clear();
        this.skipMove = true;

        this.indx = indx;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.speed = speed;
        this.range = range;
        this.layer = layer;
        this.ownerSID = ownerSID;
        this.active = true;

        const data = items.projectiles[indx];
        this.dmg = data.dmg;
        this.scale = data.scale;
    }

    private handleMovement(dt: number) {
        let tmpSpeed = this.speed * dt;
        const players = PlayerManager.players;

        if (!this.skipMove) {
            this.x += tmpSpeed * Math.cos(this.dir);
            this.y += tmpSpeed * Math.sin(this.dir);
            this.range -= tmpSpeed;

            if (this.range <= 0) {
                this.x += this.range * Math.cos(this.dir);
                this.y += this.range * Math.sin(this.dir);
                tmpSpeed = 1;
                this.range = 0;
                this.active = false;
            }
        } else {
            this.skipMove = false;
        }

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            if (player && !this.sentTo.has(player.socketId) && player.canSee(this)) {
                this.sentTo.add(player.socketId);
                SessionManager.get(player.socketId)!.send(
                    PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE,
                    this.x,
                    this.y,
                    this.dir,
                    this.range,
                    this.speed,
                    this.indx,
                    this.layer,
                    this.sid
                );
            }
        }

        return tmpSpeed;
    }

    private gatherCollisions(tmpSpeed: number) {
        const hitList: (GameObject | Player)[] = [];
        const players = PlayerManager.players;
        const gameObjects = ObjectManager.getObjects(this.x, this.y);

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            const playerPos = player.position;
            const isEnemy = this.ownerSID !== player.sid;

            if (player && isEnemy) {
                if (lineInRect(
                    playerPos.x - 35, playerPos.y - 35,
                    playerPos.x + 35, playerPos.y + 35,
                    this.x, this.y,
                    this.x + tmpSpeed * Math.cos(this.dir),
                    this.y + tmpSpeed * Math.sin(this.dir),
                )) {
                    hitList.push(player);
                }
            }
        }

        for (let i = 0, len = gameObjects.length; i < len; i++) {
            const gameObject = gameObjects[i];
            const tmpScale = gameObject.getScale();

            if (gameObject.active && this.layer <= gameObject.layer && !gameObject.ignoreCollision) {
                if (lineInRect(
                    gameObject.x - tmpScale, gameObject.y - tmpScale,
                    gameObject.x + tmpScale, gameObject.y + tmpScale,
                    this.x, this.y,
                    this.x + tmpSpeed * Math.cos(this.dir),
                    this.y + tmpSpeed * Math.sin(this.dir)
                )) {
                    hitList.push(gameObject);
                }
            }
        }

        return hitList;
    }

    private resolveCollisions(hitList: (GameObject | Player)[]) {
        if (hitList.length === 0) return;

        let hitObj: GameObject | Player = hitList[0];
        let shortDistSq = Infinity;
        const owner = PlayerManager.get(this.ownerSID);
        const players = PlayerManager.players;

        for (let i = 0, len = hitList.length; i < len; i++) {
            const obj = hitList[i];
            const distSq = obj instanceof Player ? getDistSq(this, obj.position) : getDistSq(this, obj);

            if (distSq <= shortDistSq) {
                shortDistSq = distSq;
                hitObj = obj;
            }
        }

        if (owner) hitObj.changeHealth(this.dmg, owner);

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            if (this.sentTo.has(player.socketId)) {
                if (hitObj instanceof GameObject) {
                    SessionManager.get(player.socketId)!.send(PacketMap.SERVER_TO_CLIENT.WIGGLE_GAME_OBJECT, this.dir, hitObj.sid);
                }

                SessionManager.get(player.socketId)!.send(PacketMap.SERVER_TO_CLIENT.REMOVE_PROJECTILE, this.sid, Math.sqrt(shortDistSq));
            }
        }

        this.active = false;
        this.range = 0;
    }

    update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        const tmpSpeed = this.handleMovement(dt);
        const hitList = this.gatherCollisions(tmpSpeed);
        this.resolveCollisions(hitList);
    }
}