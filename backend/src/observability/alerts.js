import logger from "./logger.js";

// Always logs at fatal; ALERT_WEBHOOK_URL, read per call, can also receive any JSON POST.
const getWebhookUrl = () => process.env.ALERT_WEBHOOK_URL;

// A persistent condition alerts once per cooldown, not on every tick.
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const lastAlertAt = new Map();

const postWebhook = async (kind, details) => {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `[mosaic] ${kind}: ${JSON.stringify(details)}` }),
        });
    } catch (error) {
        logger.error({ err: error, kind }, "alert webhook delivery failed");
    }
};

// `kind` keys the cooldown; `details` goes into the log line and webhook payload.
const sendAlert = (kind, details = {}) => {
    const now = Date.now();
    const last = lastAlertAt.get(kind) || 0;
    if (now - last < ALERT_COOLDOWN_MS) return;
    lastAlertAt.set(kind, now);

    logger.fatal({ kind, ...details }, "alert condition triggered");
    postWebhook(kind, details);
};

// Test-only: cooldowns otherwise leak state across test cases sharing this module.
const _resetForTests = () => lastAlertAt.clear();

export { sendAlert, _resetForTests };
