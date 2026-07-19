import PlayerManager from "@core/PlayerManager";
import getDistSq from "@utils/getDistSq";
import Player, { weaponVariants } from "@utils/Player";
import randString from "@utils/randString";

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
        } else if (cmdId === "spawn" || cmdId === "s") {
            const bot = PlayerManager.create(randString(), "Bot");
            bot.isAI = true;
        }
    }
}