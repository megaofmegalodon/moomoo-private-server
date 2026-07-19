import PlayerManager from "@core/PlayerManager";
import ProjectileManager from "@core/ProjectileManager";
import SessionManager from "@network/SessionManager";
import getDir from "@utils/getDir";
import getDistSq from "@utils/getDistSq";
import items from "@utils/items";
import PacketMap from "@utils/PacketMap";
import Player from "@utils/Player";

export default class GameObject {
    sid: number = -1;

    name: string;
    id: number;

    isPlayer: false = false;
    active: boolean = true;

    blocker: number;
    layer: number = 0;

    isItem: boolean;

    ignoreCollision: boolean;
    hideFromEnemy: boolean;
    isGhost: boolean = false;
    willBreak = false;

    dmg: number;
    pDmg: number;
    projDmg: boolean;
    colDiv: number;

    trap: boolean;
    zIndex: number;

    pps: number;
    turnSpeed: number;

    healCol: number;
    teleport: boolean;
    boostSpeed: number;
    projectile: number;
    shootRange: number;
    shootRate: number;
    spawnPoint: boolean;
    hasHealth: boolean;

    ownerSID: number | undefined;

    isGameObject: true = true;

    health: number;
    maxHealth: number;

    constructor(
        public x: number,
        public y: number,
        public dir: number,
        public scale: number,
        public type: number,
        itemId: number,
        ownerSID?: number
    ) {
        const data = items.list[itemId] || {};
        const group = data.group;

        this.layer = 2;

        if (group) {
            this.layer = group.layer;
        } else if (this.type === 0) {
            this.layer = 3;
        } else if (this.type === 2) {
            this.layer = 0;
        } else if (this.type === 4) {
            this.layer = -1;
        }

        this.ownerSID = ownerSID;
        this.isItem = typeof itemId === "number";

        this.id = data.id!;
        this.blocker = data.blocker ?? 0;

        this.health = data.health ?? Infinity;
        this.maxHealth = data.health ?? Infinity;
        this.hasHealth = isFinite(this.health);

        this.name = data.name ?? "";
        this.colDiv = data.colDiv ?? 1;
        this.ignoreCollision = data.ignoreCollision ?? false;
        this.hideFromEnemy = data.hideFromEnemy ?? false;
        this.projDmg = data.projDmg ?? false;
        this.dmg = data.dmg ?? 0;
        this.pDmg = data.pDmg ?? 0;
        this.pps = data.pps ?? 0;
        this.zIndex = data.zIndex ?? 0;
        this.turnSpeed = data.turnSpeed ?? 0;
        this.trap = data.trap ?? false;
        this.healCol = data.healCol ?? 0;
        this.teleport = data.teleport ?? false;
        this.boostSpeed = data.boostSpeed ?? 0;
        this.projectile = data.projectile ?? -1;
        this.shootRange = data.shootRange ?? 0;
        this.shootRate = data.shootRate ?? 0;
        this.spawnPoint = data.spawnPoint ?? false;
    }

    private static typeIds = new Set([2, 3, 4]);
    sentTo = new Set<string>();
    turretReload = 0;

    visibleToPlayer(player: Player) {
        return !this.hideFromEnemy || this.ownerSID === player.sid;
    }

    changeHealth(amt: number) {
        this.health += amt;
    }

    getScale(sM = 1, ig = false): number {
        const isSimpleItem = this.isItem || GameObject.typeIds.has(this.type);
        const baseScale = this.scale * (isSimpleItem ? 1 : 0.6 * sM);
        return ig ? baseScale : baseScale * this.colDiv;
    }

    update(dt: number) {
        if (this.name !== "turret") return;

        this.turretReload -= dt;
        if (this.turretReload > 0) return;
        this.turretReload = 2200;

        const players = PlayerManager.players;
        const owner = PlayerManager.get(this.ownerSID!)!;
        const target = players.filter(player =>
            player.isAlive &&
            player.sid !== this.ownerSID &&
            getDistSq(player.position, this) <= 490000
        ).sort((a, b) => getDistSq(a.position, this) - getDistSq(b.position, this))[0];

        if (!target) return;

        const proj = items.projectiles[1];
        const dir = getDir(target.position, this);
        this.dir = dir;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];

            if (this.sentTo.has(player.socketId)) {
                SessionManager.get(player.socketId)!.send(PacketMap.SERVER_TO_CLIENT.SHOOT_TURRET, this.sid, dir);
            }
        }

        ProjectileManager.add(
            this.x,
            this.y,
            dir,
            proj.range ?? 700,
            proj.speed ?? 1.5,
            1,
            owner.sid,
            owner.zIndex,
            this.sid,
        );
    }
}