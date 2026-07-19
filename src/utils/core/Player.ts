import ObjectManager from "@core/ObjectManager";
import PlayerManager from "@core/PlayerManager";
import ProjectileManager from "@core/ProjectileManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import getAngleDist from "@utils/getAngleDist";
import getDir from "@utils/getDir";
import getDist from "@utils/getDist";
import getDistSq from "@utils/getDistSq";
import items, { LIST_ID_MAP, ListId, ListItem, WEAPON_ID_MAP, WeaponId } from "@utils/items";
import PacketMap from "@utils/PacketMap";
import Projectile from "@utils/Projectile";
import randInt from "@utils/randInt";
import { accessories, hats, STORE_ACCESSORY_ID, STORE_HAT_ID, STORE_HAT_MAP } from "@utils/store";

export type PlayerInitType = [
    id: string, sid: number,
    name: string,
    x: number, y: number, dir: number,
    health: number, maxHealth: number,
    scale: number, skinColor: number
];

export const weaponVariants = [{
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

    isAI = false;
    aiSettings = {
        heal: false
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
    points = 1e6;
    weaponXP: Record<number, number> = Object.fromEntries([...Array(16).keys()].map(k => [k, 0]));
    reloads: Record<number, number> = Object.fromEntries([...(Array(16).keys()), 53].map(k => [k, 0]));
    autoGather = false;

    private gearCooldown = 0;
    private timerCount = 0;
    private hitTime = 0;
    private lockMove = false;
    private speed = Configuration.PLAYER_SPEED;

    XP = 0;
    maxXP = 300;
    age = 1;

    upgradePoints = 0;
    upgrAge = 2;
    mouseState = 0;

    constructor(
        public socketId: string,
        public sid: number,
        public name: string
    ) {
        this.spawn(name);
    }

    buildItem(item: ListItem) {
        const tmpScale = this.scale + item.scale + (item.placeOffset || 0);
        const tmpX = this.position.x + (tmpScale * Math.cos(this.dir));
        const tmpY = this.position.y + (tmpScale * Math.sin(this.dir));

        if (item.consume || ObjectManager.checkItem(tmpX, tmpY, item.scale, item.id)) {
            let done = false;

            if (item.consume) {
                if (this.hitTime && !this.isAI) {
                    if (Date.now() - this.hitTime <= Configuration.SERVER_UPDATE_SPEED) {
                        this.shameCount++;

                        if (this.shameCount >= 8) {
                            this.shameCount = 0;
                            this.shameTimer = Configuration.SHAME_DURATION;
                        }
                    } else {
                        this.shameCount = Math.max(0, this.shameCount - 2);
                    }

                    this.hitTime = 0;
                }

                if (this.shameTimer <= 0) {
                    done = true;

                    if (item.name == "apple") {
                        this.changeHealth(20, this);
                    } else if (item.name == "cookie") {
                        this.changeHealth(40, this);
                    } else if (item.name == "cheese") {
                        this.changeHealth(30, this);
                    }
                }
            } else {
                done = true;
                ObjectManager.add(tmpX, tmpY, this.dir, item.scale, item.type ?? -999, item.id, this.sid);
            }

            if (done) {
                this.buildIndex = -1;
            }
        }
    }

    changeGear(id: number, index: boolean) {
        const bucket = index ? accessories : hats;
        const inBucket = bucket.some(e => e.id === id);

        if (!inBucket) return false;
        if (this.gearCooldown !== 0) return false;
        this.gearCooldown = 1;

        if (index) {
            this.tailIndex = id as any;
            return true;
        }

        this.skinIndex = id as any;
        return true;
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
        this.autoGather = false;
        this.mouseState = 0;

        this.age = 1;
        this.XP = 0;
        this.maxXP = 300;

        this.upgradePoints = 0;
        this.upgrAge = 2;

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
        const session = SessionManager.get(this.socketId);
        if (!session) return;

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

            const doerSession = SessionManager.get(doer.socketId);
            if (doerSession) doerSession.send(PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYER_VALUE, "kills", doer.kills, true);
        }

        this.lastDeath.x = this.position.x;
        this.lastDeath.y = this.position.y;
        this.sentTo.clear();

        const victimSession = SessionManager.get(this.socketId);
        if (victimSession) victimSession.send(PacketMap.SERVER_TO_CLIENT.KILL_PLAYER);
    }

    changeHealth(amt: number, doer: Player) {
        if (amt > 0 && this.health >= this.maxHealth) return;
        if (!this.isAlive) return;

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
                const otherSession = SessionManager.get(other.socketId);
                if (otherSession) otherSession.send(PacketMap.SERVER_TO_CLIENT.UPDATE_HEALTH, this.sid, this.health);
            }
        }

        if (doer && !(doer == this && amt < 0)) {
            const doerSession = SessionManager.get(doer.socketId);
            if (doerSession) doerSession.send(
                PacketMap.SERVER_TO_CLIENT.SHOW_TEXT,
                this.position.x, this.position.y,
                Math.round(-amt), 1
            );
        }
    }

    earnXP(amount: number) {
        if (this.age >= 100) return;
        this.XP += amount;

        const session = SessionManager.get(this.socketId);

        if (this.XP >= this.maxXP) {
            if (this.age < 100) {
                this.age++;
                this.XP = 0;
                this.maxXP *= 1.2;
            } else {
                this.XP = this.maxXP;
            }

            this.upgradePoints++;

            if (session) {
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_UPGRADES, this.upgradePoints, this.upgrAge);
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_AGE, this.XP, this.maxXP, this.age);
            }
        } else {
            if (session) session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_AGE, this.XP, undefined, undefined);
        }
    }

    canSee(other: Player | Projectile) {
        if (!other) return false;
        const pos = other instanceof Player ? other.position : other;
        const dx = Math.abs(pos.x - this.position.x) - other.scale;
        const dy = Math.abs(pos.y - this.position.y) - other.scale;
        return dx <= (Configuration.MAX_SCREEN_WIDTH / 2) * 1.3 && dy <= (Configuration.MAX_SCREEN_HEIGHT / 2) * 1.3;
    }

    earnWeaponXP(amt: number) {
        this.weaponXP[this.weaponIndex] += amt;
    }

    private gather() {
        const wpn = items.weapons[this.weaponIndex];
        const variant = this.fetchVariant();
        const variantMlt = variant.val;

        const skin = hats.find(e => e.id === this.skinIndex);
        const tail = accessories.find(e => e.id === this.tailIndex);
        let hasHitSomething = false;

        const gameObjects = ObjectManager.getObjects(this.position.x, this.position.y);
        const gameObjectDamage = wpn.dmg * variantMlt * (wpn.sDmg || 1) * (skin?.bDmg || 1);
        const wiggleGameObects = [];

        for (let i = 0, len = gameObjects.length; i < len; i++) {
            const gameObject = gameObjects[i];

            if (gameObject.active) {
                const dist = getDist(this.position, gameObject) - gameObject.scale;
                const isWithinRange = dist <= wpn.range;

                const tmpDir = getDir(gameObject, this.position);
                const isPointingAt = getAngleDist(tmpDir, this.dir) <= Configuration.GATHER_ANGLE;

                if (isWithinRange && isPointingAt) {
                    hasHitSomething = true;

                    if (gameObject.health) {
                        gameObject.changeHealth(-gameObjectDamage);

                        if (gameObject.health <= 0) {
                            const req = items.list[gameObject.id].req;
                            for (let j = 1; j < req.length; j += 2) {
                                const cost = req[j];
                                if (typeof cost === "number") this.earnWeaponXP(cost);
                            }

                            ObjectManager.remove(gameObject.sid);
                            continue;
                        }
                    }

                    wiggleGameObects.push([tmpDir, gameObject.sid]);
                }
            }
        }

        const players = PlayerManager.players;

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            if (!player) continue;
            const isEnemy = this.sid !== player.sid;

            if (player.isAlive && isEnemy) {
                const dist = getDist(this.position, player.position) - (this.scale * 1.8);
                const withinRange = dist <= wpn.range;

                const tmpDir = getDir(player.position, this.position);
                const pointingAt = getAngleDist(tmpDir, this.dir) <= Configuration.GATHER_ANGLE;

                if (withinRange && pointingAt) {
                    let damage = wpn.dmg * variantMlt * (skin?.dmgMultO || 1) * (tail?.dmgMultO || 1);

                    const otherWpn = items.weapons[player.weaponIndex];
                    const otherSkin = hats.find(e => e.id === this.skinIndex);
                    const otherTail = accessories.find(e => e.id === this.tailIndex);

                    if (otherSkin?.dmgK) {
                        this.velocity.x -= otherSkin.dmgK * Math.cos(tmpDir);
                        this.velocity.y -= otherSkin.dmgK * Math.sin(tmpDir);
                    }

                    if (otherWpn.shield && getAngleDist(tmpDir + Math.PI, player.dir) <= Configuration.SHIELD_ANGLE) {
                        damage /= variantMlt;
                        damage *= otherWpn.shield;
                    }

                    const tmpSpd = .3 + (wpn.knock || 0);
                    player.velocity.x += tmpSpd * Math.cos(tmpDir);
                    player.velocity.y += tmpSpd * Math.sin(tmpDir);

                    if (otherSkin?.dmg) this.changeHealth(-damage * otherSkin.dmg, player);
                    if (otherTail?.dmg) this.changeHealth(-damage * otherTail.dmg, player);

                    if (otherSkin?.healD) {
                        this.changeHealth(damage * otherSkin.healD, this);
                    }

                    if (otherTail?.healD) {
                        this.changeHealth(damage * otherTail.healD, this);
                    }

                    player.changeHealth(-damage, this);
                }
            }

            if (player.canSee(this)) {
                const playerSession = SessionManager.get(player.socketId);
                if (!playerSession) continue;

                for (const data of wiggleGameObects) {
                    playerSession.send(PacketMap.SERVER_TO_CLIENT.WIGGLE_GAME_OBJECT, data[0], data[1]);
                }

                playerSession.send(PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION, this.sid, hasHitSomething, this.weaponIndex);
            }
        }
    }

    private updateAntiCheatModifiers() {
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
        const skin = hats.find(e => e.id === this.skinIndex);
        const tail = accessories.find(e => e.id === this.tailIndex);
        const spdMult = (this.buildIndex >= 0 ? .5 : 1) * (wpn?.spdMult || 1) * (skin?.spdMult ?? 1) * (tail?.spdMult ?? 1);
        const spdMag = this.speed * spdMult * dt;

        const xVel = Math.cos(this.moveDir);
        const yVel = Math.sin(this.moveDir);

        this.velocity.x += xVel * spdMag;
        this.velocity.y += yVel * spdMag;
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
                const isEnemy = typeof gameObject.ownerSID !== "number" || this.sid !== gameObject.ownerSID;

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
                    this.position.x = randInt(0, Configuration.MAP_SIZE);
                    this.position.y = randInt(0, Configuration.MAP_SIZE);
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
            if (Math.abs(this.velocity.y) <= 0.01) this.velocity.y = 0;
        }
    }

    private handleWeapons(dt: number) {
        if (this.buildIndex !== -1)
            return;

        if (this.reloads[this.weaponIndex] > 0) {
            this.reloads[this.weaponIndex] -= dt;
            return;
        }

        if (!this.autoGather) return;

        let done = true;
        const skin = hats.find(e => e.id == this.skinIndex);
        const wpn = items.weapons[this.weaponIndex || 0];

        if (wpn.gather !== undefined) {
            this.gather();
        } else if (wpn.projectile !== undefined) {
            const tmpIndx = wpn.projectile;
            const projOffset = this.scale * 2;
            const aMlt = (skin && skin.aMlt) ? skin.aMlt : 1;
            const proj = items.projectiles[tmpIndx];

            if (wpn.rec) {
                this.velocity.x -= wpn.rec * Math.cos(this.dir);
                this.velocity.y -= wpn.rec * Math.sin(this.dir);
            }

            ProjectileManager.add(
                this.position.x + (projOffset * Math.cos(this.dir)),
                this.position.y + (projOffset * Math.sin(this.dir)),
                this.dir,
                (proj?.range ?? 700) * aMlt,
                (proj?.speed ?? 1.5) * aMlt,
                tmpIndx,
                this.sid,
                this.zIndex
            );
        } else {
            done = false;
        }

        if (done) this.reloads[this.weaponIndex] = wpn.speed * (skin?.atkSpd ?? 1);
    }

    private handleTurret(dt: number) {
        if (this.reloads[STORE_HAT_MAP.TURRET_GEAR] > 0) {
            this.reloads[STORE_HAT_MAP.TURRET_GEAR] -= dt;
            if (this.reloads[STORE_HAT_MAP.TURRET_GEAR] <= 0) this.reloads[STORE_HAT_MAP.TURRET_GEAR] = 0;
        }

        if (this.reloads[STORE_HAT_MAP.TURRET_GEAR] !== 0) return;
        if (this.skinIndex !== STORE_HAT_MAP.TURRET_GEAR) return;

        const players = PlayerManager.players;
        const enemy = players.filter(player =>
            player.isAlive &&
            player.skinIndex !== STORE_HAT_MAP.EMP_HELMET &&
            player.canSee(this) &&
            player.sid !== this.sid &&
            getDistSq(player.position, this.position) <= 490000
        ).sort((a, b) => getDistSq(a.position, this.position) - getDistSq(b.position, this.position))[0];

        if (!enemy) return;

        const proj = items.projectiles[1];
        const dir = getDir(enemy.position, this.position);

        ProjectileManager.add(
            this.position.x,
            this.position.y,
            dir,
            proj.range ?? 700,
            proj.speed ?? 1.5,
            1,
            this.sid,
            this.zIndex
        );

        this.reloads[STORE_HAT_MAP.TURRET_GEAR] = 2500;
    }

    update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        this.preTick(dt);
        if (!this.isAlive) return;
        if (this.age <= 9 && this.sentTo.has(this.socketId)) this.earnXP(this.maxXP);

        if (this.health !== this.maxHealth && this.isAI && this.aiSettings.heal)
            this.changeHealth(this.maxHealth - this.health, this);

        this.handleMovementInputs(dt);
        this.updatePosition(dt);
        this.handleTurret(dt);
        this.handleWeapons(dt);
    }
}