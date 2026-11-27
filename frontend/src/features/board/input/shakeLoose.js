export const SHAKEN_LOOSE_EVENT = "mosaic:shaken-loose";

// A shake is several quick reversals of a drag, each a real swing, all inside a short window.
const SWING_PX = 14;
const REVERSALS = 4;
const WINDOW_MS = 900;

// Feed one pointer position per move of a drag; true once, the moment the drag becomes a shake.
export function createShakeDetector() {
    let direction = 0;
    let anchor = null;
    let reversals = [];
    let shaken = false;

    return (x, time) => {
        if (shaken) return false;
        if (anchor === null) {
            anchor = x;
            return false;
        }
        const travel = x - anchor;
        if (Math.abs(travel) < SWING_PX) return false;
        const heading = Math.sign(travel);
        if (direction !== 0 && heading !== direction) reversals.push(time);
        direction = heading;
        anchor = x;
        reversals = reversals.filter((at) => time - at <= WINDOW_MS);
        shaken = reversals.length >= REVERSALS;
        return shaken;
    };
}
