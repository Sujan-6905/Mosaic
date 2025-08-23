import Drawing from "../models/drawingSchema.js";
import User from "../models/userSchema.js"; // Assuming a User model exists
import { nanoid } from "nanoid";

const createDrawing = async (req, res) => {
    try {
        const { title, userId } = req.body;

        if (!title || !userId) {
            return res.status(400).json({
                message: "title and userId are necessary for creating a drawing",
            });
        }

        const shareId = nanoid(10);

        const newDrawing = await Drawing.createDrawing({
            title,
            shareId,
            ownerId: userId,
        });

        return res
            .status(200)
            .json({ message: "Drawing created successfully", data: newDrawing });
    } catch (error) {
        return res.status(400).json({ message: "error creating drawing " + error });
    }
};

const getDrawings = async (req, res) => {
    try {
        const { userId } = req.user;

        if (!userId) {
            return res
                .status(400)
                .json({ message: "userId is must for getting drawings" });
        }

        const ownedDrawings = await Drawing.find({ owner: userId }).sort({
            createdAt: -1,
        });

        const sharedWithDrawings = await Drawing.find({ shared: userId }).sort({
            createdAT: -1,
        });

        const data = { ownedDrawings, sharedWithDrawings };

        return res.status(200).json({
            message:
                "drawings owned or accessible by the user is fetched successfully",
            data,
        });
    } catch (error) {
        return res.status(400).json({ message: "error getting drawings", error });
    }
};

const getDrawingById = async (req, res) => {
    try {
        const { shareId } = req.params;
        const { userId } = req.user;


        if (!shareId || !userId) {
            return res.status(400).json({
                message: "shareId and userId is must for getting drawing by id",
            });
        }

        const drawing = await Drawing.findOne({ shareId });

        const hasAccess = drawing.hasEditAccess(userId);

        if (!hasAccess) {
            return res.status(403).json({ message: "access forbidden" });
        }

        return res
            .status(200)
            .json({ message: "drawing fetched successfully", data: drawing });
    } catch (error) {
        return res
            .status(400)
            .json({ message: "error getting drawing By Id", error });
    }
};

// this function is called from socket server
const saveCanvasToDB = async ({ canvasShareId, canvasElements }) => {
    try {
        console.log(canvasElements);

        const updatedDrawing = await Drawing.findOneAndUpdate(
            { shareId: canvasShareId },
            { elements: canvasElements, updatedAt: new Date() },
            { upsert: true, new: true },
        );
        console.log(updatedDrawing);
    } catch (error) {
        console.log("error saving canvas to DB", error);
    }
};

const loadDataFromDB = async (shareId) => {
    try {
        const drawing = await Drawing.findOne({ shareId });

        return drawing.elements;
    } catch (error) {
        console.log("error loading data from DB", error);
    }
};

const deleteDrawing = async (req, res) => {
    try {
        const { drawingId } = req.params;

        if (!drawingId) {
            return res
                .status(400)
                .json({ message: "drawing id needed for deletion" });
        }

        await Drawing.deleteOne({ _id: drawingId });

        return res.status(200).json({ message: "drawing deleted successfully" });
    } catch (error) {
        return res.status(400).json({ message: "error deleting drawing", error });
    }
};

const updateDrawingTitle = async (req, res) => {
    try {
        const { drawingId } = req.params;
        const { newTitle } = req.body;

        if (!drawingId || !newTitle) {
            return res.status(400).json({
                message:
                    "drawing id and newTitle are both needed for updating the title of the drawing",
            });
        }

        await Drawing.findOneAndUpdate(
            { _id: drawingId },
            { title: newTitle, updateAt: new Date() },
        );

        return res
            .status(200)
            .json({ message: "drawing title updated successfully" });
    } catch (error) {
        return res
            .status(400)
            .json({ message: "error updating drawing title", error });
    }
};

const addCollaborator = async (req, res) => {
    try {
        console.log('add collaborators called');
        const { email } = req.body;
        const { shareId } = req.params;
        const { userId } = req.user;

        if (!shareId || !email) {
            return res.status(400).json({ message: "Email and shareId are required to add a collaborator." });
        }


        const drawing = await Drawing.findOne({ shareId });
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found." });
        }

        // Check if the authenticated user is the owner
        if (drawing.owner.toString() !== userId) {
            return res.status(403).json({ message: "Access forbidden. Only the owner can add collaborators." });
        }

        const userToAdd = await User.findOne({ email });
        if (!userToAdd) {
            return res.status(404).json({ message: "User with this email not found." });
        }

        // Check if the user is already a collaborator or the owner
        if (drawing.shared.includes(userToAdd._id) || drawing.owner.equals(userToAdd._id)) {
            return res.status(409).json({ message: "User is already a collaborator or the owner." });
        }

        drawing.shared.push(userToAdd._id);
        await drawing.save();

        return res.status(200).json({ message: "Collaborator added successfully." });
    } catch (error) {
        console.error("Error adding collaborator:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const removeCollaborator = async (req, res) => {
    try {
        const { email } = req.body;
        const { shareId } = req.params;
        const { userId } = req.user;

        if (!shareId || !email) {
            return res.status(400).json({ message: "Email and shareId are required to remove a collaborator." });
        }

        const drawing = await Drawing.findOne({ shareId });
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found." });
        }

        // Check if the authenticated user is the owner
        if (drawing.owner.toString() !== userId) {
            return res.status(403).json({ message: "Access forbidden. Only the owner can remove collaborators." });
        }

        const userToRemove = await User.findOne({ email });
        if (!userToRemove) {
            return res.status(404).json({ message: "User with this email not found." });
        }

        // Use $pull to remove the collaborator from the shared array
        const updatedDrawing = await Drawing.findOneAndUpdate(
            { shareId: shareId },
            { $pull: { shared: userToRemove._id } },
            { new: true }
        );

        if (!updatedDrawing) {
            return res.status(500).json({ message: "Failed to update drawing." });
        }

        return res.status(200).json({ message: "Collaborator removed successfully." });
    } catch (error) {
        console.error("Error removing collaborator:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
}

const getCollaborator = async (req, res) => {
    try {
        const { shareId } = req.params;
        const { userId } = req.user;

        if (!shareId) {
            return res.status(400).json({ message: "ShareId is required to fetch collaborators." });
        }

        const drawing = await Drawing.findOne({ shareId });
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found." });
        }

        // Check if the authenticated user has access to the drawing
        if (!drawing.hasEditAccess(userId)) {
            return res.status(403).json({ message: "Access forbidden. Only with access can view this list." });
        }

        const collaborators = await Drawing.findOne({ shareId })
            .select("shared")
            .populate({
                path: "shared",
                select: "email", // Only return the email field
            });

        if (!collaborators) {
            return res.status(404).json({ message: "Collaborators not found." });
        }

        return res.status(200).json({ message: "Collaborators fetched successfully.", collaborators: collaborators.shared });
    } catch (error) {
        console.error("Error fetching collaborators:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
}


export {
    createDrawing,
    getDrawings,
    getDrawingById,
    saveCanvasToDB,
    loadDataFromDB,
    deleteDrawing,
    updateDrawingTitle,
    addCollaborator,
    removeCollaborator,
    getCollaborator,
};
