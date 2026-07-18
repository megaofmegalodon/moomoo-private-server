import ObjectManager from "@core/ObjectManager";
import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import getDir from "@utils/getDir";
import getDist from "@utils/getDist";
import getDistSq from "@utils/getDistSq";
import items, { LIST_ID_MAP, ListId, WEAPON_ID_MAP, WeaponId } from "@utils/items";
import PacketMap from "@utils/PacketMap";
import randInt from "@utils/randInt";
import { accessories, hats, STORE_ACCESSORY_ID, STORE_HAT_ID, STORE_HAT_MAP } from "@utils/store";

export type PlayerInitType = [
    id: string, sid: number,
    name: string,
    x: number, y: number, dir: number,
    health: number, maxHealth: number,
    scale: number, skinColor: number
];

const weaponVariants = [{
    id: 0,
    xp: 0,
    val: 1
}, {
    id: 1,
    xp: 3000,
    val: 1.1
}, {
    id: 2,
    xp: 7000,
    val: 1.18
}, {
    id: 3,
    poison: true,
    xp: 12000,
    val: 1.18
}];

export default class Player {
    sentTo = new Set<string>();

    position: Point = { x: 0, y: 0 };
    velocity: Point = { x: 0, y: 0 };
    dir = 0;

    weapons: WeaponId[] = [WEAPON_ID_MAP.TOOL_HAMMER];
    items: ListId[] = [LIST_ID_MAP.APPLE, LIST_ID_MAP.WOOD_WALL, LIST_ID_MAP.SPIKES, LIST_ID_MAP.WINDMILL];

    health = 100;
    readonly maxHealth = 100;

    private lastDeath: Point = {
        x: randInt(0, Configuration.MAP_SIZE),
        y: randInt(0, Configuration.MAP_SIZE)
    };

    shameCount = 0;
    shameTimer: number = 0;
    readonly scale = 35;

    buildIndex = -1;
    weaponIndex: WeaponId = 0;
    zIndex = 0;

    skinIndex: STORE_HAT_ID = 0;
    tailIndex: STORE_ACCESSORY_ID = 0;
    moveDir: number | null | undefined = null;

    kills = 0;
    weaponXP: Record<number, number> = Object.fromEntries([...Array(16).keys()].map(k => [k, 0]));
    reloads: Record<number, number> = Object.fromEntries([...(Array(16).keys()), 53].map(k => [k, 0]));

    private gearCooldown = 0;
    private placementCount = 0;
    private timerCount = 0;
    private hitTime = 0;
    private lockMove = false;
    private speed = Configuration.PLAYER_SPEED;

    constructor(
        public socketId: string,
        public sid: number,
        public name: string
    ) {
        this.spawn(name);
    }

    buildItem() {
        //logic wip

        if (this.placementCount >= 2 && Configuration.ANTI_CHEAT) return;
        this.placementCount++;
    }

    changeGear(id: number, index: boolean) {
        const bucket = index ? accessories : hats;
        const inBucket = bucket.some(e => e.id === id);

        if (!inBucket) return;
        if (this.gearCooldown !== 0) return;

        this.gearCooldown = Configuration.ANTI_CHEAT ? 3 : 1;

        if (index) {
            this.tailIndex = id as any;
            return;
        }

        this.skinIndex = id as any;
    }

    fetchVariant() {
        const wpnXP = this.weaponXP[this.weaponIndex] ?? 0;

        for (let i = weaponVariants.length - 1; i >= 0; i--) {
            if (wpnXP >= weaponVariants[i].xp) return weaponVariants[i];
        }

        return weaponVariants[0]; // this is not gonna run but just to make sure
    }

    getUpdateData() {
        return [
            this.sid,
            this.position.x,
            this.position.y,
            this.dir,
            this.buildIndex,
            this.weaponIndex,
            this.fetchVariant().id,
            null,
            false,
            this.skinIndex,
            this.tailIndex,
            0,
            this.zIndex
        ];
    }

    getInitData(): PlayerInitType {
        return [
            this.socketId,
            this.sid,
            this.name,
            this.position.x,
            this.position.y,
            this.dir,
            this.health,
            this.maxHealth,
            this.scale,
            0
        ];
    }

    get isAlive() {
        return this.health > 0;
    }

    spawn(name: string) {
        this.kills = 0;

        this.position.x = this.lastDeath.x + randInt(-500, 500);
        this.position.y = this.lastDeath.y + randInt(-500, 500);

        this.name = name.slice(0, 15) ?? "unknown";
        this.shameCount = 0;
        this.shameTimer = 0;

        this.weapons = [WEAPON_ID_MAP.TOOL_HAMMER];
        this.items = [LIST_ID_MAP.APPLE, LIST_ID_MAP.WOOD_WALL, LIST_ID_MAP.SPIKES, LIST_ID_MAP.WINDMILL];

        this.weaponXP = Object.fromEntries([...Array(16).keys()].map(k => [k, 0]));
        this.reloads = Object.fromEntries([...(Array(16).keys()), 53].map(k => [k, 0]));

        this.weaponIndex = 0;
        this.buildIndex = -1;

        this.health = this.maxHealth;
    }

    grantAllEverything() {
        const session = SessionManager.get(this.socketId)!;

        for (const hat of hats) {
            if (!hat.price) continue;
            session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS, false, hat.id, 0);
        }

        for (const accessory of accessories) {
            if (!accessory.price) continue;
            session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS, false, accessory.id, 1);
        }
    }

    kill(doer: Player) {
        if (doer && doer.isAlive) {
            doer.kills++;

            const doerSession = SessionManager.get(doer.socketId)!;
            doerSession.send(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYER_VALUE, "kills", doer.kills, true);
        }

        SessionManager.get(this.socketId)!.send(PacketMap.SERVER_TO_CLIENT.KILL_PLAYER);
    }

    changeHealth(amt: number, doer: Player) {
        if (amt > 0 && this.health >= this.maxHealth) return false

        const skin = hats.find(e => e.id == this.skinIndex);
        const players = PlayerManager.players;

        if (amt < 0 && skin) amt *= (skin?.dmgMult ?? 1);
        if (amt < 0) this.hitTime = Date.now();

        this.health += amt;
        if (this.health > this.maxHealth) {
            amt -= (this.health - this.maxHealth);
            this.health = this.maxHealth;
        }

        if (this.health <= 0) this.kill(doer);

        for (let i = 0, len = players.length; i < len; i++) {
            const other = players[i];

            if (this.sentTo.has(other.socketId) || players[i] == this) {
                const otherSession = SessionManager.get(other.socketId)!;
                otherSession.send(PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH, this.sid, this.health);
            }
        }

        if (doer && !(doer == this && amt < 0)) {
            const doerSession = SessionManager.get(doer.socketId)!;
            doerSession.send(
                PacketMap.SERVER_TO_CLIENT.SHOW_TEXT,
                this.position.x, this.position.y,
                Math.round(-amt), 1
            );
        }

        return true;
    }

    canSee(other: Player) {
        if (!other) return false;
        const dx = Math.abs(other.position.x - this.position.x) - other.scale;
        const dy = Math.abs(other.position.y - this.position.y) - other.scale;
        return dx <= (Configuration.MAX_SCREEN_WIDTH / 2) * 1.3 && dy <= (Configuration.MAX_SCREEN_HEIGHT / 2) * 1.3;
    }

    private updateAntiCheatModifiers() {
        this.placementCount = 0;
        this.gearCooldown = Math.max(this.gearCooldown - 1, 0);
    }

    private preTick(dt: number) {
        this.updateAntiCheatModifiers();

        this.shameTimer -= dt;
        if (this.shameTimer <= 0) {
            this.shameTimer = 0;
        } else {
            this.skinIndex = STORE_HAT_MAP.SHAME;
        }

        this.timerCount -= dt;
        if (this.timerCount <= 0) {
            const skin = hats.find(e => e.id == this.skinIndex);
            const tail = accessories.find(e => e.id == this.tailIndex);
            const regenAmount = (tail?.healthRegen ?? 0) + (skin?.healthRegen ?? 0);

            if (regenAmount) {
                this.changeHealth(regenAmount, this);
            }

            this.timerCount = Configuration.AUTO_REGEN_COOLDOWN;
        }
    }

    private handleMovementInputs(dt: number) {
        if (this.lockMove) {
            this.velocity.x = 0;
            this.velocity.y = 0;
            return;
        }

        if (typeof this.moveDir !== "number") return;

        const wpn = items.weapons[this.weaponIndex];
        const skin = hats.find(e => e.id == this.skinIndex);
        const tail = accessories.find(e => e.id == this.tailIndex);
        const spdMult = (this.buildIndex >= 0 ? .5 : 1) * (wpn?.spdMult || 1) * (skin?.spdMult ?? 1) * (tail?.spdMult ?? 1);

        let xVel = Math.cos(this.moveDir);
        let yVel = Math.sin(this.moveDir);

        const spdMag = this.speed * spdMult * dt;
        const length = Math.sqrt(xVel * xVel + yVel * yVel);

        xVel /= length;
        yVel /= length;

        if (xVel) this.velocity.x += xVel * spdMag;
        if (yVel) this.velocity.y += yVel * spdMag;
    }

    private checkPlayerCollision(other: Player) {
        const dx = this.position.x - other.position.x;
        const dy = this.position.y - other.position.y;
        const tmpLen = this.scale + other.scale;

        if (Math.abs(dx) > tmpLen && Math.abs(dy) > tmpLen) return;

        let tmpInt = getDist(this.position, other.position) - tmpLen;
        if (tmpInt > 0) return;

        const tmpDir = getDir(this.position, other.position);
        tmpInt = (tmpInt * -1) / 2;

        this.position.x += (tmpInt * Math.cos(tmpDir));
        this.position.y += (tmpInt * Math.sin(tmpDir));
        other.position.x -= (tmpInt * Math.cos(tmpDir));
        other.position.y -= (tmpInt * Math.sin(tmpDir));

        if (other.zIndex > this.zIndex) this.zIndex = other.zIndex;
    }

    private handleObjectCollisions(dt: number) {
        const gameObjects = ObjectManager.getObjects(this.position.x, this.position.y);

        for (let i = 0, len = gameObjects.length; i < len; i++) {
            const gameObject = gameObjects[i];
            if (!gameObject) continue;

            const tmpScale = this.scale + gameObject.getScale();
            const distSq = getDistSq(this.position, gameObject);
            const tmpScaleSq = tmpScale * tmpScale;

            if (distSq <= tmpScaleSq && gameObject.active) {
                const isEnemy = this.sid === 0 ? gameObject.ownerSID !== 0 : gameObject.ownerSID === 0;

                if (!gameObject.ignoreCollision) {
                    const tmpDir = getDir(this.position, gameObject);

                    this.position.x = gameObject.x + (tmpScale * Math.cos(tmpDir));
                    this.position.y = gameObject.y + (tmpScale * Math.sin(tmpDir));
                    this.velocity.x *= 0.75;
                    this.velocity.y *= 0.75;

                    if (gameObject.dmg && isEnemy) {
                        this.changeHealth(-gameObject.dmg, PlayerManager.get(gameObject.ownerSID!)!);
                        this.velocity.x += 1.5 * Math.cos(tmpDir);
                        this.velocity.y += 1.5 * Math.sin(tmpDir);
                    }
                } else if (gameObject.trap && isEnemy) {
                    this.lockMove = true;
                    gameObject.hideFromEnemy = false;
                } else if (gameObject.boostSpeed) {
                    const mag = dt * gameObject.boostSpeed;
                    this.velocity.x += mag * Math.cos(gameObject.dir);
                    this.velocity.y += mag * Math.sin(gameObject.dir);
                } else if (gameObject.teleport) {
                    this.velocity.x = randInt(0, Configuration.MAP_SIZE);
                    this.velocity.y = randInt(0, Configuration.MAP_SIZE);
                }

                if (gameObject.zIndex > this.zIndex) this.zIndex = gameObject.zIndex;
            }
        }
    }

    private updatePosition(dt: number) {
        const players = PlayerManager.players;
        const tmpSpeed = getDist({ x: 0, y: 0 }, { x: this.velocity.x * dt, y: this.velocity.y * dt });
        const depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
        const tMlt = 1 / depth;

        this.lockMove = false;
        for (let i = 0; i < depth; i++) {
            if (this.velocity.x) this.position.x += (this.velocity.x * dt) * tMlt;
            if (this.velocity.y) this.position.y += (this.velocity.y * dt) * tMlt;
            this.handleObjectCollisions(dt);
        }

        const tmpIndx = players.indexOf(this);
        for (let i = tmpIndx + 1; i < players.length; i++) {
            const other = players[i];
            if (other.isAlive) this.checkPlayerCollision(players[i]);
        }

        this.handleDeceleration(dt);

        this.position.x = Math.max(this.scale, Math.min(this.position.x, Configuration.MAP_SIZE - this.scale));
        this.position.y = Math.max(this.scale, Math.min(this.position.y, Configuration.MAP_SIZE - this.scale));
    }

    private handleDeceleration(dt: number) {
        if (this.velocity.x) {
            this.velocity.x *= Math.pow(Configuration.PLAYER_DECELERATION, dt);
            if (Math.abs(this.velocity.x) <= 0.01) this.velocity.x = 0;
        }

        if (this.velocity.y) {
            this.velocity.y *= Math.pow(Configuration.PLAYER_DECELERATION, dt);
            if (Math.abs(this.velocity.y)) this.velocity.y = 0;
        }
    }

    update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        this.preTick(dt);
        if (!this.isAlive) return;

        this.handleMovementInputs(dt);
        this.updatePosition(dt);
    }
}