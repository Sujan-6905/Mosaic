import { v2 as cloudinary } from "cloudinary";

// The browser uploads straight to Cloudinary with this signature; only the signed params are trusted.
const UPLOAD_FOLDER = "mosaic-boards";

const getCloudinarySignature = (req, res) => {
    // A GET, so the read-only check in authCheck lets it through; it still leads to a write.
    if (req.user.scope === "read") return res.status(403).json({ message: "This token can only read.", code: "read_only_token" });
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return res.status(503).json({ message: "Image upload is not configured on this server" });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder: UPLOAD_FOLDER }, apiSecret);

    return res.status(200).json({ cloudName, apiKey, timestamp, signature, folder: UPLOAD_FOLDER });
};

export { getCloudinarySignature };
