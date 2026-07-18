import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import { LIST_ID_MAP, ListId, WEAPON_ID_MAP, WeaponId } from "@utils/items";
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
        this.shameTimer = Configuration.SHAME_DURATION;

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

            this.timerCount = 1e3;
        }
    }

    update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        this.preTick(dt);
        if (!this.isAlive) return;
    }
}