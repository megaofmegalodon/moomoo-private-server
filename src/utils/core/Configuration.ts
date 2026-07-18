const Configuration = {
    PLAYER_SPEED: .0016,
    MAP_SIZE: 14400,
    SHAME_DURATION: 5_000, // 5 seconds, original game is 30 seconds
    SERVER_UPDATE_SPEED: 1e3 / 9, // don't change this if u don't want the game to explode
    ANTI_CHEAT: false, // basically enables a decent anticheat
    AUTO_REGEN_COOLDOWN: 1000,
    PLAYER_DECELERATION: .993,
    MAX_SCREEN_WIDTH: 1920,
    MAX_SCREEN_HEIGHT: 1080,
    GATHER_ANGLE: Math.PI / 2.6,
    SHIELD_ANGLE: Math.PI / 3
} as const;

export default Configuration;