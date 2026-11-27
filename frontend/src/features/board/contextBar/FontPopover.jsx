import { useRef, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import Popover from "@/components/ui/Popover";
import StrokeIcon from "@/components/ui/StrokeIcon";
import FontChoiceList from "../stylePickers/FontChoices";
import { fontLabel, saveFont } from "../stylePickers/FontChoices/fontChoices";
import { loadFontSource } from "../rendering/fontLoader";
import { fontFamilyStack, isFontFileBytes, parseFontInput } from "../../../../../shared/canvas/elements/fontSources";
import { BarButton } from "./popovers";
import styles from "./FontPopover.module.css";

const MAX_FONT_FILE_BYTES = 5 * 1024 * 1024;
const FONT_FILE_ACCEPT = ".woff2,.woff,.ttf,.otf";

const uploadFontFile = async (file, accessToken) => {
    const { data: signed } = await axiosInstance.get("/api/upload/cloudinary-signature", { headers: { Authorization: `Bearer ${accessToken}` } });
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", signed.timestamp);
    form.append("signature", signed.signature);
    if (signed.folder) form.append("folder", signed.folder);
    const { data: uploaded } = await axios.post(`https://api.cloudinary.com/v1_1/${signed.cloudName}/raw/upload`, form);
    return uploaded.secure_url;
};

// A font file linked from another site is copied into the app's own uploads
// once, by whoever adds it, so viewers never fetch from that site.
const copyLinkedFont = async (link, family, accessToken) => {
    let response;
    try {
        response = await fetch(link);
    } catch {
        throw new Error("That site doesn't let its font be copied here. Download it and use Upload a file.");
    }
    if (!response.ok) throw new Error("That link didn't return a font file");
    const blob = await response.blob();
    if (blob.size > MAX_FONT_FILE_BYTES) throw new Error("Font files can be up to 5 MB");
    if (!isFontFileBytes(new Uint8Array(await blob.slice(0, 4).arrayBuffer()))) throw new Error("That link didn't return a font file");
    const extension = new URL(link).pathname.split(".").pop().toLowerCase();
    return uploadFontFile(new File([blob], `${family}.${extension}`), accessToken);
};

// Pastes a Google Fonts name or link, a direct font-file link, or uploads a
// file; the font is loaded for real before it is applied, so a bad link fails here.
function AddFontForm({ onAdded }) {
    const { data: session } = useSession();
    const fileInputRef = useRef(null);
    const [input, setInput] = useState("");
    const [name, setName] = useState("");
    const [problem, setProblem] = useState(null);
    const [busy, setBusy] = useState(false);
    const isFileLink = /^https:\/\/.+\.(woff2|woff|ttf|otf)(\?.*)?$/i.test(input.trim());

    const add = async (rawInput, displayName) => {
        const parsed = parseFontInput(rawInput, displayName);
        if (parsed.error) {
            setProblem(parsed.error);
            return;
        }
        setBusy(true);
        setProblem(null);
        try {
            const source = parsed.fileLink ? { kind: "file", url: await copyLinkedFont(parsed.fileLink, parsed.family, session?.accessToken) } : parsed.source;
            await loadFontSource(parsed.family, source);
            saveFont(parsed.family, source);
            onAdded({ family: parsed.family, fontFamily: fontFamilyStack(parsed.family), source });
            setInput("");
            setName("");
        } catch (error) {
            setProblem(error.response?.data?.message || error.message || "That font couldn't be loaded");
        } finally {
            setBusy(false);
        }
    };

    const uploadAndAdd = async (file) => {
        if (!file) return;
        if (file.size > MAX_FONT_FILE_BYTES) {
            setProblem("Font files can be up to 5 MB");
            return;
        }
        setBusy(true);
        setProblem(null);
        try {
            const url = await uploadFontFile(file, session?.accessToken);
            await add(
                url,
                name ||
                    file.name
                        .replace(/\.[^.]+$/, "")
                        .replace(/[^A-Za-z0-9 _-]+/g, " ")
                        .trim(),
            );
        } catch (error) {
            setProblem(error.response?.data?.message || "Upload failed");
            setBusy(false);
        }
    };

    return (
        <form
            className={styles.addForm}
            onKeyDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
                event.preventDefault();
                add(input, name);
            }}
        >
            <label className={styles.addLabel} htmlFor="board-font-input">
                Add a font
            </label>
            <input
                id="board-font-input"
                className={styles.input}
                placeholder="Google Fonts name or link, or a .woff2 link"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={busy}
            />
            {isFileLink && (
                <input
                    className={styles.input}
                    placeholder="Name it (optional)"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={busy}
                    aria-label="Font name"
                />
            )}
            {problem && (
                <p role="alert" className={styles.problem}>
                    {problem}
                </p>
            )}
            <div className={styles.actions}>
                <button type="button" className={styles.upload} onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    <StrokeIcon name="upload" size={13} />
                    Upload a file
                </button>
                <button type="submit" className={styles.add} disabled={busy || !input.trim()}>
                    {busy ? "Loading" : "Add"}
                </button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept={FONT_FILE_ACCEPT}
                hidden
                onChange={(event) => {
                    uploadAndAdd(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
        </form>
    );
}

// The bar's font control: every font on offer, plus adding your own.
export default function FontPopover({ element, onUpdate }) {
    const apply = (font) => onUpdate({ fontFamily: font.fontFamily, fontSource: font.source });
    const label = fontLabel(element.fontFamily);
    return (
        <Popover
            align="start"
            trigger={
                <BarButton label={`Font: ${label}`} wide>
                    <span className={styles.triggerLabel} style={{ fontFamily: element.fontFamily }}>
                        {label}
                    </span>
                    <StrokeIcon name="chevronDown" size={10} strokeWidth={3} />
                </BarButton>
            }
        >
            <div className={styles.pop}>
                <FontChoiceList current={element} onPick={apply} />
                <AddFontForm onAdded={apply} />
            </div>
        </Popover>
    );
}
