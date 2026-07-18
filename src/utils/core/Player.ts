import Configuration from "@utils/Configuration";
import { LIST_ID_MAP, ListId, WEAPON_ID_MAP, WeaponId } from "@utils/items";
import randInt from "@utils/randInt";
import { STORE_ACCESSORY_ID, STORE_HAT_ID } from "@utils/store";

type PlayerInitType = [
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
    shameTimer = Configuration.SHAME_DURATION;
    readonly scale = 35;

    buildIndex = -1;
    weaponIndex: WeaponId = 0;
    zIndex = 0;

    skinIndex: STORE_HAT_ID = 0;
    tailIndex: STORE_ACCESSORY_ID = 0;

    weaponXP: Record<number, number> = Object.fromEntries([...Array(16).keys()].map(k => [k, 0]));
    reloads: Record<number, number> = Object.fromEntries([...(Array(16).keys()), 53].map(k => [k, 0]));

    constructor(
        public socketId: string,
        public sid: number,
        public name: string
    ) {
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

    spawn(name: string) {
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
}