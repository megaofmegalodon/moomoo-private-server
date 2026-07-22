import ObjectManager from "@core/ObjectManager";
import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import Configuration from "@utils/Configuration";
import GameObject from "@utils/GameObject";
import { LIST_ID_MAP, WEAPON_ID_MAP } from "@utils/items";
import PacketMap from "@utils/PacketMap";
import Player, { weaponVariants } from "@utils/Player";
import randInt from "@utils/randInt";

const arenaX = Configuration.MAP_SIZE / 2;
const arenaY = Configuration.MAP_SIZE - 1200;

export default class ArenaManager {
    static status = false;

    private static gameObjects: GameObject[] = [];
    private static fighters: Player[] = [];
    private static countdown = 0;

    private static setEquipment(player: Player, level: number = 1) {
        player.items = [
            LIST_ID_MAP.COOKIE, LIST_ID_MAP.WOOD_WALL, LIST_ID_MAP.SPINNING_SPIKES,
            LIST_ID_MAP.WINDMILL, LIST_ID_MAP.PIT_TRAP, LIST_ID_MAP.TELEPORTER
        ];

        if (level >= 1) player.weaponXP[WEAPON_ID_MAP.GREAT_HAMMER] = weaponVariants[1].xp;

        if (level >= 3) {
            player.weapons = [WEAPON_ID_MAP.POLEARM, WEAPON_ID_MAP.GREAT_HAMMER];
            if (level >= 4) player.weaponXP[WEAPON_ID_MAP.POLEARM] = weaponVariants[2].xp;
            return;
        }

        player.weapons = [WEAPON_ID_MAP.DAGGERS, WEAPON_ID_MAP.GREAT_HAMMER];
    }

    private static regear(player: Player) {
        const currentScore = this.fighters.reduce((prev, curr) => Math.max(curr.score, prev), 0);
        const scoreGap = currentScore - player.score;

        if (currentScore >= 2 && scoreGap === 0 && this.fighters.every(f => f.score === currentScore)) {
            this.setEquipment(player, 4);
        } else if (scoreGap >= 3) {
            this.setEquipment(player, 4);
        } else if (scoreGap === 2) {
            this.setEquipment(player, 3);
        } else if (currentScore > 0) {
            this.setEquipment(player, 2);
        } else {
            this.setEquipment(player, 1);
        }
    }

    private static end(winner: Player) {
        for (let i = 0; i < this.fighters.length; i++) {
            const fighter = this.fighters[i];
            if (fighter === winner) continue;

            const session = SessionManager.get(fighter.socketId);
            if (session) session.close();
            else PlayerManager.remove(fighter.sid);
        }

        this.fighters.length = 0;
        this.status = false;
    }

    static update() {
        if (!this.status) return;

        if (PlayerManager.players.length <= 1) {
            this.status = false;
            this.countdown = 0;
            this.fighters.length = 0;
            this.gameObjects.length = 0;
            return;
        }

        if (this.countdown > 0) {
            this.countdown--;

            if (this.countdown <= 0) {
                for (let i = 0; i < this.fighters.length; i++) {
                    const fighter = this.fighters[i];
                    const session = SessionManager.get(fighter.socketId);

                    if (session) {
                        fighter.updateWeaponry();
                        session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, fighter.weapons, true);
                        session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, fighter.items, false);
                    }
                }

                this.gameObjects.forEach(e => ObjectManager.remove(e.sid));
                this.gameObjects.length = 0;
            }
            return;
        }

        let fightersLeft = 0;
        let lastFigherIndex = 0;

        for (let i = 0; i < this.fighters.length; i++) {
            const fighter = this.fighters[i];

            if (fighter.isAlive && fighter.shameCount < 8) {
                fightersLeft++;
                lastFigherIndex = i;
            }
        }

        if (fightersLeft > 1) return;

        this.countdown = 18; // wait 9 gameticks
        const winner = this.fighters[lastFigherIndex];
        winner.score++;
        if (winner.score >= 5) return this.end(winner);

        for (let i = 0; i < this.fighters.length; i++) {
            const fighter = this.fighters[i];
            ObjectManager.removeAll(fighter.sid);

            for (let j = 0; j < this.fighters.length; j++) {
                const otherSession = SessionManager.get(this.fighters[j].socketId);
                if (otherSession) otherSession.send(PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS, fighter.sid);
            }

            fighter.spawn(fighter.name);
            fighter.position.x = arenaX + randInt(-300, 300);
            fighter.position.y = arenaY + randInt(-300, 300);

            this.regear(fighter);
            this.pausePlayer(fighter);
        }
    }

    private static pausePlayer(player: Player) {
        const trapScale = 50;
        const trapId = 15;

        const trap = ObjectManager.add(
            player.position.x, player.position.y,
            0, trapScale, -1, trapId
        );

        trap.health = trap.maxHealth = trap.maxHealth * 1000;
        this.gameObjects.push(trap);
    }

    static process(player: Player, parsed: string[]) {
        const fighters: Player[] = [player];
        const sids = parsed.slice(1);
        const players = PlayerManager.players;

        for (let i = 0; i < players.length; i++) {
            const other = players[i];
            if (!other) continue;
            if (other === player) continue;
            if (!sids.some(e => parseInt(e) === other.sid)) continue;
            fighters.push(other);
        }

        if (fighters.length <= 1) return;

        for (let i = players.length - 1; i >= 0; i--) {
            const other = players[i];
            if (!other) continue;

            ObjectManager.removeAll(other.sid);

            for (let j = 0; j < this.fighters.length; j++) {
                const otherSession = SessionManager.get(this.fighters[j].socketId);
                if (otherSession) otherSession.send(PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS, other.sid);
            }

            if (fighters.includes(other)) continue;

            const session = SessionManager.get(other.socketId);
            if (session) session.close();
            else PlayerManager.remove(other.sid);
        }

        for (let i = 0; i < fighters.length; i++) {
            const fighter = fighters[i];
            const session = SessionManager.get(fighter.socketId);

            fighter.score = 0;
            fighter.spawn(fighter.name);
            fighter.position.x = arenaX + randInt(-300, 300);
            fighter.position.y = arenaY + randInt(-300, 300);
            this.setEquipment(fighter);
            this.pausePlayer(fighter);
            this.fighters.push(fighter);

            if (session) {
                fighter.updateWeaponry();
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, fighter.weapons, true);
                session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, fighter.items, false);
            }
        }

        this.countdown = 9;
        this.status = true;
    }
}