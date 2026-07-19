import Configuration from "@utils/Configuration";
import items from "@utils/items";
import Projectile from "@utils/Projectile";

export default class ProjectileManager {
    static projectiles: Projectile[] = [];

    static add(x: number, y: number, dir: number, range: number, speed: number, indx: number, owner: number, layer: number) {
        const tmpData = items.projectiles[indx];
        const projectiles = this.projectiles;
        let tmpProj;

        for (var i = 0; i < projectiles.length; ++i) {
            if (!projectiles[i].active) {
                tmpProj = projectiles[i];
                break;
            }
        }

        if (!tmpProj) {
            tmpProj = new Projectile(projectiles.length, indx, x, y, dir, speed, range, layer || tmpData.layer, owner);
            projectiles.push(tmpProj);
        }

        tmpProj.init(indx, x, y, dir, speed, range, layer || tmpData.layer, owner);
    }

    static update(dt: number = Configuration.SERVER_UPDATE_SPEED) {
        const projectiles = this.projectiles;

        for (let i = 0; i < projectiles.length; i++) {
            const proj = projectiles[i];
            if (proj.active) proj.update(dt);
        }
    }
}