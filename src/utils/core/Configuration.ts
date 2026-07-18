const Configuration = {
    PLAYER_SPEED: .0016,
    MAP_SIZE: 14400,
    SHAME_DURATION: 15_000, // 15 seconds
    SERVER_UPDATE_SPEED: 1e3 / 9 // don't change this if u don't want the game to explode
} as const;

export default Configuration;