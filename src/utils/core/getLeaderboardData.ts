import PlayerManager from "@core/PlayerManager";

export default function getLeaderboardData() {
    const data: any[] = [];
    PlayerManager.players.filter(e => e.isAlive).slice(0, 10).forEach(e => data.push(e.sid, e.name, 1e6));
    return data;
}