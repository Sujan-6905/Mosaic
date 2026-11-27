import crypto from "node:crypto";
import logger from "../../observability/logger.js";
import Drawing from "../../models/drawingSchema.js";
import { nullIfMissing } from "../../db/errors.js";
import { isLinkShared } from "../../models/accessControl.js";
import { appUrl } from "../origins.js";
import { secretsMatch } from "../../auth/secretsMatch.js";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

const slackConfigured = () => Boolean(process.env.SLACK_SIGNING_SECRET && process.env.SLACK_BOT_TOKEN);

// Slack signs every request with the app's secret over the raw body and a
// timestamp; anything unsigned, re-signed or replayed later is refused.
const isSignedBySlack = (req) => {
    const timestamp = Number(req.get("x-slack-request-timestamp"));
    const signature = req.get("x-slack-signature") ?? "";
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false;
    const expected = `v0=${crypto
        .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
        .update(`v0:${timestamp}:${req.body.toString("utf8")}`)
        .digest("hex")}`;
    return secretsMatch(signature, expected);
};

const shareIdIn = (link) => {
    try {
        const url = new URL(link);
        if (url.origin !== appUrl()) return null;
        return /^\/embed\/([A-Za-z0-9_-]{1,40})$/.exec(url.pathname)?.[1] ?? url.searchParams.get("shareId");
    } catch {
        return null;
    }
};

// Only a board anyone may view unfurls with its picture; any other link to
// Mosaic gets a card that names nothing about the board.
const unfurlFor = async (link) => {
    const shareId = shareIdIn(link);
    const drawing = shareId ? await nullIfMissing(() => Drawing.findOne({ shareId })) : null;
    if (!drawing || !isLinkShared(drawing)) {
        return { blocks: [{ type: "section", text: { type: "mrkdwn", text: "A Mosaic board. Open it to see it if you have access." } }] };
    }
    const boardLink = `${appUrl()}/?shareId=${encodeURIComponent(shareId)}`;
    return {
        blocks: [
            { type: "section", text: { type: "mrkdwn", text: `*${(drawing.title || "Untitled board").replace(/[<>&*_~`]/g, "")}*` } },
            ...(drawing.embed?.enabled
                ? [{ type: "image", image_url: `${appUrl()}/api/embed/${encodeURIComponent(shareId)}/snapshot.png`, alt_text: drawing.title || "Mosaic board" }]
                : []),
            { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open in Mosaic" }, url: boardLink }] },
        ],
    };
};

const unfurlLinks = async (event) => {
    const unfurls = {};
    for (const { url } of event.links ?? []) unfurls[url] = await unfurlFor(url);
    const response = await fetch("https://slack.com/api/chat.unfurl", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        body: JSON.stringify({ channel: event.channel, ts: event.message_ts, unfurls }),
    });
    const result = await response.json().catch(() => null);
    if (!result?.ok) logger.warn({ error: result?.error, channel: event.channel }, "slack unfurl refused");
};

// Slack's Events API: answers the one-time URL check, and unfurls board links
// as they're posted. Slack wants an answer within 3 seconds, so the unfurl runs after.
const slackEvents = (req, res) => {
    if (!slackConfigured()) return res.status(404).end();
    if (!isSignedBySlack(req)) return res.status(401).end();
    let payload;
    try {
        payload = JSON.parse(req.body.toString("utf8"));
    } catch {
        return res.status(400).end();
    }
    if (payload.type === "url_verification") return res.status(200).json({ challenge: payload.challenge });
    res.status(200).end();
    if (payload.type === "event_callback" && payload.event?.type === "link_shared") {
        unfurlLinks(payload.event).catch((error) => logger.error({ err: error }, "error unfurling a link in slack"));
    }
    return undefined;
};

export { slackEvents };
