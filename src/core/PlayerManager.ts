import Player from "@utils/Player";

export default class PlayerManager {
    static players: Player[] = [];
    private static idMap = new Map<string, Player>();
    private static sidMap = new Map<number, Player>();

    static has(identifier: string | number) {
        if (typeof identifier === "string") return this.idMap.has(identifier);
        return this.sidMap.has(identifier);
    }

    static get(identifier: string | number) {
        if (typeof identifier === "string") return this.idMap.get(identifier);
        return this.sidMap.get(identifier);
    }

    static remove(identifier: string | number) {
        const players = this.players;
        const isString = typeof identifier === "string";

        for (let i = 0, len = players.length; i < len; i++) {
            let found = false;
            const player = players[i];

            if (isString) {
                if (player.socketId === identifier) {
                    found = true;
                }
            } else {
                if (player.sid === identifier) {
                    found = true;
                }
            }

            if (found) {
                this.idMap.delete(player.socketId);
                this.sidMap.delete(player.sid);
                break;
            }
        }
    }
}