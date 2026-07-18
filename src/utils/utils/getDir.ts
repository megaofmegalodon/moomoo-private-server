/**
 * The radian angle from a to b
 * 
 * @param a - The position of the end
 * @param b - The position of the start
 */

export default function getDir(a: Point, b: Point) {
    return Math.atan2(a.y - b.y, a.x - b.x);
}