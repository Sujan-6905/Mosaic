import { z } from "zod";
import { isPushServiceEndpoint } from "../services/webPush.js";

const endpointSchema = z.string().max(1000).refine(isPushServiceEndpoint, "Not a browser push service address");
const base64Url = (max) =>
    z
        .string()
        .min(1)
        .max(max)
        .regex(/^[A-Za-z0-9_-]+=*$/);

export const pushSubscribeSchema = z.object({
    endpoint: endpointSchema,
    keys: z.object({ p256dh: base64Url(200), auth: base64Url(100) }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: endpointSchema });
