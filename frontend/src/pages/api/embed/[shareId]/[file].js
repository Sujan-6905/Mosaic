import sharp from "sharp";
import { buildSvgDocument } from "@/features/board/exportImport/sceneExport";
import { getUnionBounds } from "../../../../../../shared/canvas/geometry/bounds.js";

const SNAPSHOT_SECONDS = 30;
const MAX_PNG_WIDTH = 1200;
const FILES = new Set(["snapshot.svg", "snapshot.png"]);
const SHARE_ID = /^[A-Za-z0-9_-]{1,40}$/;

// A picture of a board shared by link, for link previews, oEmbed thumbnails and
// embeds past their live-viewer cap. Only what an anonymous viewer could see.
export default async function handler(req, res) {
    const { shareId, file, frame, version } = req.query;
    if (!SHARE_ID.test(shareId ?? "") || !FILES.has(file)) return res.status(404).end();
    const query = new URLSearchParams(Object.entries({ frame, version }).filter(([, value]) => typeof value === "string"));
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/embed/${shareId}/scene?${query}`).catch(() => null);
    if (!response?.ok) return res.status(response?.status === 401 || response?.status === 403 ? 404 : 502).end();
    const scene = await response.json();
    const elements = scene.elements ?? {};
    const bounds = getUnionBounds(Object.values(elements)) ?? { minX: 0, minY: 0, maxX: 400, maxY: 240 };
    const svg = buildSvgDocument(elements, scene.background, bounds);
    res.setHeader("Cache-Control", `public, max-age=${SNAPSHOT_SECONDS}, s-maxage=${SNAPSHOT_SECONDS}`);
    if (file === "snapshot.svg") {
        res.setHeader("Content-Type", "image/svg+xml");
        // The picture can't run anything, even opened on its own.
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com",
        );
        return res.status(200).send(svg);
    }
    const png = await sharp(Buffer.from(svg)).resize({ width: MAX_PNG_WIDTH, withoutEnlargement: true }).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(png);
}
