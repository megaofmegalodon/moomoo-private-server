import PlayerManager from "@core/PlayerManager";
import SessionManager from "@network/SessionManager";
import getDistSq from "@utils/getDistSq";
import PacketMap from "@utils/PacketMap";
import Player, { weaponVariants } from "@utils/Player";
import randInt from "@utils/randInt";
import randString from "@utils/randString";
import { STORE_HAT_MAP } from "@utils/store";

export default class CommandManager {
    static process(player: Player, msg: string) {
        const parsed = msg.slice(1).split(" ");
        const cmdId = parsed[0];

        if (cmdId === "n" || cmdId === "nearest") {
            const nearest = PlayerManager.players
                .filter(other => other.isAlive && other.sid !== player.sid)
                .sort((a, b) => getDistSq(a.position, player.position) - getDistSq(b.position, player.position))[0];

            if (nearest) {
                player.position.x = nearest.position.x;
                player.position.y = nearest.position.y;
            }
        } else if (cmdId === "r" || cmdId === "ruby") {
            player.weaponXP[player.weaponIndex] = weaponVariants[3].xp;
        } else if (cmdId === "d" || cmdId === "dia") {
            player.weaponXP[player.weaponIndex] = weaponVariants[2].xp;
        } else if (cmdId === "g" || cmdId === "gold") {
            player.weaponXP[player.weaponIndex] = weaponVariants[1].xp;
        } else if (cmdId === "stone") {
            player.weaponXP[player.weaponIndex] = 0;
        } else if (cmdId === "k" || cmdId === "kill") {
            player.kill(player);
        } else if (cmdId === "spawn" || cmdId === "s" || cmdId === "ss" || cmdId === "sh" || cmdId === "ssh") {
            const bot = PlayerManager.create(randString(), "Bot");
            bot.position.x = player.position.x + randInt(-500, 500);
            bot.position.y = player.position.y + randInt(-500, 500);
            bot.isAI = true;

            const cmdParts = cmdId.split("");

            if (cmdParts.filter(e => e === "s").length >= 2) {
                bot.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
            }

            if (cmdParts.includes("h")) {
                bot.aiSettings.heal = true;
            }
        } else if (cmdId === "reset" || cmdId === "re") {
            const session = SessionManager.get(player.socketId)!;
            const lastX = player.position.x;
            const lastY = player.position.y;

            player.spawn(player.name);
            player.position.x = lastX;
            player.position.y = lastY;

            session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_ITEMS, player.weapons, true);
            session.send(PacketMap.SERVER_TO_CLIENT.UPDATE_UPGRADES, player.upgradePoints, player.upgrAge);

        }
    }
}