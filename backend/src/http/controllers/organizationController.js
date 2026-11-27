import { nullIfMissing } from "../../db/errors.js";
import { SearchConsistency, getDefaultInstance } from "ottoman";
import Category, { SECTIONS } from "../../models/categorySchema.js";
import BoardOrganization from "../../models/boardOrganizationSchema.js";
import Drawing from "../../models/drawingSchema.js";
import logger from "../../observability/logger.js";

const bucketName = () => process.env.CB_BUCKET_NAME;

const findCategoryById = (categoryId) => nullIfMissing(() => Category.findById(categoryId));

const findDrawingByShareId = (shareId) => nullIfMissing(() => Drawing.findOne({ shareId }));

// This person's organisation rows keyed by shareId, merged into the board list in one query.
const getUserOrganizationMap = async (userId) => {
    const { rows } = await BoardOrganization.find({ userId }, { consistency: SearchConsistency.GLOBAL });
    const byShareId = {};
    rows.forEach((row) => {
        byShareId[row.shareId] = { categoryId: row.categoryId, favorite: row.favorite };
    });
    return byShareId;
};

const getBoardOrganizationHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { shareId } = req.params;
        const existing = await BoardOrganization.findOne({ userId, shareId }).catch(() => null);
        return res.status(200).json({
            categoryId: existing?.categoryId ?? null,
            favorite: existing?.favorite ?? false,
        });
    } catch (error) {
        logger.error({ err: error }, "error fetching board organization");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const getCategoriesHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { section } = req.query;
        if (!SECTIONS.includes(section)) {
            return res.status(400).json({ message: `section must be one of: ${SECTIONS.join(", ")}` });
        }

        const { rows } = await Category.find({ userId, section }, { sort: { order: "ASC" }, consistency: SearchConsistency.GLOBAL });
        return res.status(200).json({ categories: rows });
    } catch (error) {
        logger.error({ err: error }, "error fetching categories");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const createCategoryHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { section, name } = req.body;

        const { rows: existing } = await Category.find({ userId, section });
        const nextOrder = existing.reduce((max, category) => Math.max(max, category.order), -1) + 1;

        const category = await Category.create({ userId, section, name, order: nextOrder });
        return res.status(201).json({ message: "Category created successfully", data: category });
    } catch (error) {
        logger.error({ err: error }, "error creating category");
        return res.status(500).json({ message: "Internal server error." });
    }
};

const updateCategoryHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { categoryId } = req.params;
        const { name, order } = req.body;

        const category = await findCategoryById(categoryId);
        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }
        if (category.userId !== userId) {
            return res.status(403).json({ message: "You do not own this category." });
        }

        if (name !== undefined) category.name = name;
        if (order !== undefined) category.order = order;
        await category.save();

        return res.status(200).json({ message: "Category updated successfully", data: category });
    } catch (error) {
        logger.error({ err: error }, "error updating category");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Boards in a deleted category become uncategorised, never deleted.
const deleteCategoryHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { categoryId } = req.params;

        const category = await findCategoryById(categoryId);
        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }
        if (category.userId !== userId) {
            return res.status(403).json({ message: "You do not own this category." });
        }

        const ottoman = getDefaultInstance();
        await ottoman.query(
            `UPDATE \`${bucketName()}\`.\`app\`.\`boardOrganizations\`
             SET categoryId = null
             WHERE userId = $userId AND categoryId = $categoryId`,
            { parameters: { userId, categoryId } },
        );
        await Category.removeById(categoryId);

        return res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
        logger.error({ err: error }, "error deleting category");
        return res.status(500).json({ message: "Internal server error." });
    }
};

// Either field may be given alone. The category must be from the board's own section, so a
// board can't cross between My Boards and Shared With Me.
const setBoardOrganizationHandler = async (req, res) => {
    try {
        const { userId } = req.user;
        const { shareId } = req.params;
        const { categoryId, favorite } = req.body;

        const drawing = await findDrawingByShareId(shareId);
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found." });
        }
        if (!drawing.hasViewAccess(req.user)) {
            return res.status(403).json({ message: "access forbidden" });
        }

        if (categoryId !== undefined && categoryId !== null) {
            const category = await findCategoryById(categoryId);
            const expectedSection = drawing.owner === userId ? "owned" : "shared";
            if (!category || category.userId !== userId || category.section !== expectedSection) {
                return res.status(400).json({ message: "Invalid category for this board." });
            }
        }

        const existing = await BoardOrganization.findOne({ userId, shareId }).catch(() => null);
        const patch = {};
        if (categoryId !== undefined) patch.categoryId = categoryId;
        if (favorite !== undefined) patch.favorite = favorite;

        let saved;
        if (existing) {
            Object.assign(existing, patch);
            await existing.save();
            saved = existing;
        } else {
            saved = await BoardOrganization.create({ userId, shareId, categoryId: null, favorite: false, ...patch });
        }

        return res.status(200).json({
            message: "Board organization updated successfully",
            data: { categoryId: saved.categoryId, favorite: saved.favorite },
        });
    } catch (error) {
        logger.error({ err: error }, "error updating board organization");
        return res.status(500).json({ message: "Internal server error." });
    }
};

export {
    getUserOrganizationMap,
    getBoardOrganizationHandler,
    getCategoriesHandler,
    createCategoryHandler,
    updateCategoryHandler,
    deleteCategoryHandler,
    setBoardOrganizationHandler,
};
