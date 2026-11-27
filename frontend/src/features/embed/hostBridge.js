// The postMessage API for an embedding page: it may steer the camera and hear events but never change the board.
// Messages go to, and come only from, pages on the sites the owner allowed.

const PREFIX = "mosaic:";
const HOST_COMMANDS = ["fit", "zoomIn", "zoomOut", "setZoom", "setCamera", "goToFrame", "focusElement"];

const patternMatches = (pattern, origin) => {
    if (pattern === origin) return true;
    const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(pattern);
    if (!wildcard) return false;
    try {
        const url = new URL(origin);
        return url.protocol === `${wildcard[1]}:` && url.host.endsWith(`.${wildcard[2]}`);
    } catch {
        return false;
    }
};

const isAllowedHost = (origin, sites) => Boolean(origin) && sites.some((site) => patternMatches(site, origin));

// The origin of the page this frame sits in, as far as the browser says.
const hostOrigin = () => {
    if (typeof window === "undefined" || window.parent === window) return null;
    const ancestors = window.location.ancestorOrigins;
    if (ancestors?.length) return ancestors[0];
    try {
        return document.referrer ? new URL(document.referrer).origin : null;
    } catch {
        return null;
    }
};

export const createHostBridge = ({ sites, onCommand }) => {
    const origin = hostOrigin();
    const allowed = isAllowedHost(origin, sites);

    const onMessage = (event) => {
        if (event.source !== window.parent || !isAllowedHost(event.origin, sites)) return;
        const type = typeof event.data?.type === "string" && event.data.type.startsWith(PREFIX) ? event.data.type.slice(PREFIX.length) : null;
        if (HOST_COMMANDS.includes(type)) onCommand(type, event.data);
    };
    if (allowed) window.addEventListener("message", onMessage);

    return {
        send(type, detail = {}) {
            if (allowed) window.parent.postMessage({ type: `${PREFIX}${type}`, ...detail }, origin);
        },
        close() {
            window.removeEventListener("message", onMessage);
        },
    };
};
