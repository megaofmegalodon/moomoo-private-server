import PlayerManager from "@core/PlayerManager";

export default function getLeaderboardData() {
    const data: any[] = [];
    PlayerManager.players.slice(0, 10).forEach(e => data.push(e.sid, e.name, 1e6));
    return data;
}