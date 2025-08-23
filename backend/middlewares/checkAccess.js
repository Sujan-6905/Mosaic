import Drawing from "../models/drawingSchema.js";

const checkEditAccess = async (req, res, next) => {
    try {
        const { drawingId, userId } = req.body;

        const drawing = await Drawing.findById(drawingId);

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        const hasEditAccess = drawing.hasEditAccess(userId);

        if (!hasEditAccess) {
            return res
                .status(401)
                .json({ message: "user does not have edit permission" });
        }

        next();
    } catch (error) {
        return res
            .status(400)
            .json({ message: "error checking edit access", error });
    }
};

const checkDeleteAccess = async (req, res, next) => {
    try {
        const { drawingId, shareId } = req.params;
        const { userId } = req.user;

        let drawing = await Drawing.findById(drawingId);
        let drawingbyShareId = await Drawing.findOne({ shareId });

        if (!drawing) drawing = drawingbyShareId;

        if (!drawing) {
            return res.status(404).json({ message: "drawing not found" });
        }

        const hasDeleteAccess = drawing.hasDeleteAccess(userId);

        if (!hasDeleteAccess) {
            return res
                .status(401)
                .json({ message: "user does not have delete permission" });
        }

        next();
    } catch (error) {
        return res
            .status(400)
            .json({ message: "error checking delete access", error });
    }
};

export { checkEditAccess, checkDeleteAccess };
