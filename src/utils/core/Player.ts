export default class Player {
    name!: string;
    socketId!: string;
    sid!: number;

    spawn(name: string) {
        this.name = name;
    }
}