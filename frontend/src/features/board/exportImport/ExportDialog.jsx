import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";
import StrokeIcon from "@/components/ui/StrokeIcon";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview";
import TessellatePreview from "./TessellatePreview";
import { TESSERA_SIZES } from "./tessellate";
import { getUnionBounds } from "../../../../../shared/canvas/geometry/bounds.js";
import { timelapseSupported } from "./timelapse";
import styles from "./ExportDialog.module.css";

const FORMATS = [
    { value: "png", label: "PNG", note: "An image, at the scale you pick below." },
    { value: "svg", label: "SVG", note: "Vector, stays sharp at any size." },
    { value: "pdf", label: "PDF", note: "One page, ready to print or attach." },
    { value: "mosaic", label: ".mosaic", note: "A lossless scene file you can import back into any board." },
    {
        value: "stone",
        label: "Stone",
        note: "The board laid in hand-cut stone from its own pixels, framed in gold and signed by its people. Made to be posted.",
    },
];
const TIMELAPSE = {
    value: "timelapse",
    label: "Time-lapse",
    note: "Twenty seconds of the whole board being made, as a video ready to post. Records in this tab, so keep it open.",
};

const SCALE_OPTIONS = [1, 2, 3];

const ExportDialog = ({ isOpen, onClose, elements, background, selectedElementIds, onExport, rasterFor }) => {
    const frames = useMemo(
        () =>
            isOpen
                ? Object.entries(elements)
                      .filter(([, el]) => el.type === "frame")
                      .map(([frameId, el]) => ({ frameId, name: el.name || "Frame" }))
                : [],
        [isOpen, elements],
    );
    const [format, setFormat] = useState("png");
    const [scope, setScope] = useState("board");
    const [frameId, setFrameId] = useState(null);
    const [scale, setScale] = useState(1);
    const [transparent, setTransparent] = useState(false);
    const [tessera, setTessera] = useState("medium");
    const [raster, setRaster] = useState(null);
    const formats = useMemo(() => (isOpen && timelapseSupported() ? [...FORMATS, TIMELAPSE] : FORMATS), [isOpen]);

    const hasSelection = selectedElementIds.length > 0;
    const scopeOptions = [
        { value: "board", label: "Whole board" },
        ...(hasSelection ? [{ value: "selection", label: "Selection" }] : []),
        ...(frames.length > 0 ? [{ value: "frame", label: "A frame" }] : []),
    ];
    // A selection or frame can disappear while this stays mounted.
    const activeScope = scopeOptions.some((option) => option.value === scope) ? scope : "board";
    const canSubmit = activeScope !== "frame" || frameId;
    const activeFormat = formats.find((candidate) => candidate.value === format) ?? formats[0];
    const isTimelapse = format === "timelapse";
    const isRaster = format === "png";
    const isStone = format === "stone";
    const tesseraCell = TESSERA_SIZES.find((size) => size.value === tessera).cell;

    useEffect(() => {
        setRaster(isOpen && isStone ? rasterFor({ scope: activeScope, frameId }) : null);
    }, [isOpen, isStone, activeScope, frameId, rasterFor, elements]);

    const previewElements = useMemo(() => {
        if (!isOpen) return {};
        const entries = Object.entries(elements);
        if (activeScope === "selection") return Object.fromEntries(entries.filter(([id]) => selectedElementIds.includes(id)));
        if (activeScope === "frame" && frameId) {
            return Object.fromEntries(entries.filter(([id, element]) => id === frameId || element.frameId === frameId));
        }
        return elements;
    }, [isOpen, elements, activeScope, frameId, selectedElementIds]);

    const bounds = getUnionBounds(Object.values(previewElements));
    const dimensions = !bounds
        ? "Nothing to export"
        : isStone
          ? `About ${(Math.ceil((bounds.maxX - bounds.minX) / tesseraCell) * Math.ceil((bounds.maxY - bounds.minY) / tesseraCell)).toLocaleString("en-GB")} stones`
          : isRaster
            ? `${Math.round((bounds.maxX - bounds.minX) * scale)} x ${Math.round((bounds.maxY - bounds.minY) * scale)}`
            : activeFormat.label;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Export" size="sm">
            <div className={styles.preview} data-transparent={transparent && !isStone} data-stone={isStone} aria-label="Preview of the export">
                {isStone && raster && <TessellatePreview raster={raster} cell={tesseraCell} />}
                {!isStone && bounds && (
                    <StaticCanvasPreview
                        elements={previewElements}
                        background={transparent ? null : background}
                        width={720}
                        height={300}
                        className={styles.previewCanvas}
                    />
                )}
                <span className={styles.dimensions}>{dimensions}</span>
            </div>

            <div className={styles.section}>
                <span className={styles.label}>Format</span>
                <SegmentedControl aria-label="Export format" options={formats} value={activeFormat.value} onChange={setFormat} />
                <span className={styles.note}>{activeFormat.note}</span>
            </div>

            {!isTimelapse && (
                <div className={styles.section}>
                    <span className={styles.label}>What to export</span>
                    <SegmentedControl aria-label="Export scope" options={scopeOptions} value={activeScope} onChange={setScope} />
                    {activeScope === "frame" && (
                        <Select
                            ariaLabel="Frame to export"
                            className="w-full"
                            placeholder="Choose a frame…"
                            value={frameId}
                            onChange={setFrameId}
                            options={frames.map((frame) => ({ value: frame.frameId, label: frame.name }))}
                        />
                    )}
                </div>
            )}

            {isRaster && (
                <div className={styles.section}>
                    <span className={styles.label}>Scale</span>
                    <SegmentedControl
                        aria-label="Export scale"
                        options={SCALE_OPTIONS.map((option) => ({ value: option, label: `${option}x` }))}
                        value={scale}
                        onChange={setScale}
                    />
                </div>
            )}

            {isStone && (
                <div className={styles.section}>
                    <span className={styles.label}>Stone size</span>
                    <SegmentedControl aria-label="Stone size" options={TESSERA_SIZES} value={tessera} onChange={setTessera} />
                </div>
            )}

            {(format === "png" || format === "svg") && (
                <Switch checked={transparent} onChange={setTransparent} className={styles.transparentSwitch}>
                    Transparent background
                </Switch>
            )}

            <button
                type="button"
                className={styles.submit}
                disabled={!canSubmit && !isTimelapse}
                onClick={() => onExport({ format: activeFormat.value, scope: activeScope, frameId, scale, transparent, cell: tesseraCell })}
            >
                <StrokeIcon name="download" size={15} strokeWidth={2.2} />
                Export {activeFormat.label}
            </button>
        </Modal>
    );
};

export default ExportDialog;
