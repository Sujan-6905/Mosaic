// What counts as a safe link or embed, shared by the board and the server's
// validation, plus how a pasted address becomes something a frame can show.

const LINK_PROTOCOLS = ["http:", "https:", "mailto:"];

const parse = (value) => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

export const isSafeLink = (value) => {
    const url = parse(value);
    return Boolean(url && LINK_PROTOCOLS.includes(url.protocol));
};

// `ownOrigins` keeps the app itself out of its own frames: a page of ours inside a
// sandbox that allows same-origin would run with a signed-in user's session.
export const isSafeEmbedUrl = (value, ownOrigins = []) => {
    const url = parse(value);
    return Boolean(url && url.protocol === "https:" && !ownOrigins.includes(url.origin));
};

// Checks elements that bypassed server validation (clipboard, scene files): an embed
// with a bad address is dropped, a bad link is removed.
export const sanitizeIncomingElements = (elements, ownOrigins = []) =>
    elements.flatMap((element) => {
        if (!element || typeof element !== "object") return [];
        if (element.type === "embed" && !isSafeEmbedUrl(element.url, ownOrigins)) return [];
        if (element.link != null && !isSafeLink(element.link)) {
            const { link, ...rest } = element;
            void link;
            return [rest];
        }
        return [element];
    });

// What someone typed, as a usable link, or null. A bare domain gets https.
export const normalizeLink = (input) => {
    const text = (input || "").trim();
    if (!text) return null;
    if (isSafeLink(text)) return text;
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(text)) return `https://${text}`;
    return null;
};

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"];

// Sites that refuse to load in a frame at their normal address but publish one
// that works. Anything else loads as given and may or may not allow framing.
const EMBED_REWRITES = [
    (url) => {
        if (YOUTUBE_HOSTS.includes(url.hostname) && url.pathname === "/watch" && url.searchParams.get("v"))
            return `https://www.youtube.com/embed/${url.searchParams.get("v")}`;
        if (url.hostname === "youtu.be" && url.pathname.length > 1) return `https://www.youtube.com/embed${url.pathname}`;
        return null;
    },
    (url) => (url.hostname.endsWith("vimeo.com") && /^\/\d+/.test(url.pathname) ? `https://player.vimeo.com/video${url.pathname}` : null),
    (url) => (url.hostname.endsWith("loom.com") && url.pathname.startsWith("/share/") ? `https://www.loom.com/embed/${url.pathname.slice(7)}` : null),
    (url) =>
        url.hostname.endsWith("figma.com") && !url.hostname.startsWith("embed")
            ? `https://www.figma.com/embed?embed_host=mosaic&url=${encodeURIComponent(url.href)}`
            : null,
    (url) => (url.hostname === "codepen.io" && url.pathname.includes("/pen/") ? `https://codepen.io${url.pathname.replace("/pen/", "/embed/")}` : null),
    (url) => (url.hostname === "codesandbox.io" && url.pathname.startsWith("/s/") ? `https://codesandbox.io/embed/${url.pathname.slice(3)}` : null),
    (url) => (url.hostname === "open.spotify.com" && !url.pathname.startsWith("/embed") ? `https://open.spotify.com/embed${url.pathname}` : null),
    (url) =>
        url.hostname === "docs.google.com" && /\/(document|spreadsheets|presentation)\//.test(url.pathname) && url.pathname.endsWith("/edit")
            ? url.href.replace(/\/edit.*$/, "/preview")
            : null,
];

// Hosts known to work in a frame, so pasting one makes a live embed rather than a link.
const EMBED_FRIENDLY_HOSTS = [
    /youtube\.com$/,
    /youtu\.be$/,
    /vimeo\.com$/,
    /loom\.com$/,
    /figma\.com$/,
    /codepen\.io$/,
    /codesandbox\.io$/,
    /spotify\.com$/,
    /docs\.google\.com$/,
];

export const toEmbedUrl = (input) => {
    const link = normalizeLink(input);
    const url = link && parse(link);
    if (!url || url.protocol === "mailto:") return null;
    const secure = url.protocol === "http:" ? new URL(url.href.replace(/^http:/, "https:")) : url;
    for (const rewrite of EMBED_REWRITES) {
        const rewritten = rewrite(secure);
        if (rewritten) return rewritten;
    }
    return secure.href;
};

export const isEmbedFriendly = (input) => {
    const link = normalizeLink(input);
    const url = link && parse(link);
    return Boolean(url && EMBED_FRIENDLY_HOSTS.some((host) => host.test(url.hostname)));
};
