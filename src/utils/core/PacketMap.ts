const PacketMap = {
    CLIENT_TO_SERVER: {
        JOIN_GAME: "M",
        SEND_AIM: "D",
        MOVE: "9",
        RESET_MOVEMENT_DIR: "e",
        SEND_HIT: "F",
        SELECT_TO_BUILD: "z",
        SEND_UPGRADE: "H",
        AUTO_GATHER: "K",
        CREATE_CLAN: "L",
        LEAVE_CLAN: "N",
        JOIN_CLAN: "b",
        JOIN_REQUEST: "P",
        KICK_FROM_CLAN: "Q",
        STORE: "c",
        SEND_CHAT: "6",
        PING_MAP: "S",
        PING_SOCKET: "0"
    },

    SERVER_TO_CLIENT: {
        IO_INIT: "io-init",
        SET_INIT_DATA: "A",
        DISCONNECT: "B",
        SET_UP_GAME: "C",
        ADD_PLAYER: "D",
        REMOVE_PLAYER: "E",
        UPDATE_PLAYERS: "a",
        UPDATE_LEADERBOARD: "G",
        LOAD_GAME_OBJECT: "H",
        LOAD_AI: "I",
        ANIMATE_AI: "J",
        GATHER_ANIMATION: "K",
        WIGGLE_GAME_OBJECT: "L",
        SHOOT_TURRET: "M",
        UPDATE_PLAYER_VALUE: "N",
        UPDATE_HEALTH: "O",
        KILL_PLAYER: "P",
        KILL_OBJECT: "Q",
        KILL_OBJECTS: "R",
        UPDATE_ITEM_COUNTS: "S",
        UPDATE_AGE: "T",
        UPDATE_UPGRADES: "U",
        UPDATE_ITEMS: "V",
        ADD_PROJECTILE: "X",
        REMOVE_PROJECTILE: "Y",
        SERVER_RESTARTING: "Z",
        ADD_ALLIANCE: "g",
        DELETE_ALLIANCE: "1",
        ALLIANCE_NOTIFICATION: "2",
        SET_PLAYER_TEAM: "3",
        SET_ALLIANCE_PLAYERS: "4",
        UPDATE_STORE_ITEMS: "5",
        RECEIVE_CHAT: "6",
        UPDATE_MINIMAP: "7",
        SHOW_TEXT: "8",
        PING_MAP: "9",
        PING_RESPONSE: "0"
    }
} as const;

export interface MOOMOO_CLIENT_TO_SERVER_MAP {
    "z": [id: number, isWeapon: boolean];
    "K": [id: 1];
    "e": [];
    "6": [msg: string];
    "M": [data: { name: string, moofoll: string, skin: number }];
    "9": [angle: number | null];
    "0": [];
    "S": [];
    "D": [angle: number];
    "F": [autoGatherToggle: number, dir: number];
    "H": [id: number];
    "P": [sid: number, accepted: boolean];
    "Q": [sid: number];
    "b": [sid: string];
    "N": [];
    "L": [name: string];
    "c": [buy: boolean, id: number, index: boolean];
};

export interface MOOMOO_SERVER_TO_CLIENT_MAP {
    "io-init": [id: string, seed: number, salt: string, idk: number];
    "A": [data: { teams: any[] }];
    "C": [yourSID: number];
    "D": [
        data: any,
        isYou: boolean
    ];
    "I": [data: number[]];
    "E": [id: string];
    "Q": [sid: number];
    "R": [ownerSID: number];
    "a": [data: (string | number)[]];
    "O": [sid: number, health: number];
    "9": [x: number, y: number];
    "g": [data: any];
    "1": [
        /** sid of the alliance that should be removed */ sid: string
    ];
    "2": [sid: number, name: string];
    "3": [team: string, isOwner: boolean];
    "5": [type: boolean, id: number, index: number];
    "4": [data: (number | string)[]];
    "8": [x: number, y: number, value: number, type: number];
    "S": [index: number, value: number];
    "J": [sid: number];
    "H": [data: number[]];
    "G": [data: (number | string)[]];
    "N": [index: "stone" | "wood" | "food" | "kills" | "points", value: number, updateView: boolean];
    "T": [xp: number | undefined, mxp: number | undefined, age: number | undefined];
    "V": [data: number[] | null, wpn: boolean];
    "0": [];
    "P": [];
    "6": [sid: number, message: string];
    "K": [sid: number, didHit: boolean, index: number];
    "L": [dir: number, sid: number];
    "M": [sid: number, dir: number];
    "U": [points: number, age: number];
    "X": [x: number, y: number, dir: number, range: number, speed: number, indx: number, layer: number, sid: number];
    "Y": [sid: number, range: number];
    "7": [data: number[]];
}

export default PacketMap;