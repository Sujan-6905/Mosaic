import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview";
import { MERMAID_KINDS } from "../../../../../shared/canvas/mermaid/buildMermaidElements.js";
import { parseMermaid } from "./parseMermaid";
import styles from "./MermaidDialog.module.css";

const EXAMPLES = {
    Flowchart:
        "flowchart LR\n  subgraph Client\n    A[Browser] --> B{Signed in?}\n  end\n  B -- Yes --> C[Board]\n  B -. No .-> D([Sign in])\n  C --> E[(Database)]",
    Sequence:
        "sequenceDiagram\n  participant U as User\n  participant A as API\n  U->>A: Save board\n  A-->>U: Saved\n  Note right of A: Writes the change log",
    Class: "classDiagram\n  Shape <|-- Rectangle\n  Shape : +string id\n  Shape : +move()\n  Board *-- Shape",
    State: "stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review : submit\n  Review --> Published : approve\n  Published --> [*]",
    "Mind map": "mindmap\n  root((Launch))\n    Product\n      Polish\n      Docs\n    Marketing\n      Site\n      Video",
};
const PARSE_DELAY_MS = 250;

const MermaidDialog = ({ isOpen, onClose, buildMermaid, onPlace }) => {
    const [code, setCode] = useState("");
    const [parsed, setParsed] = useState(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            if (!code.trim()) {
                setParsed(null);
                return;
            }
            parseMermaid(code).then((result) => !cancelled && setParsed(result));
        }, PARSE_DELAY_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [code, isOpen]);

    const preview = useMemo(
        () => (parsed && !parsed.error ? Object.fromEntries(buildMermaid(parsed).map(({ elementId, element }) => [elementId, element])) : null),
        [parsed, buildMermaid],
    );
    const counts = preview ? Object.values(preview).reduce((tally, element) => ({ ...tally, [element.type]: (tally[element.type] || 0) + 1 }), {}) : null;

    const close = () => {
        setCode("");
        setParsed(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={close} title="Mermaid to board" size="lg">
            <p className={styles.lede}>
                Paste Mermaid code. It becomes ordinary shapes and arrows you can edit, restyle and move. Works with {MERMAID_KINDS.join(", ").toLowerCase()}.
            </p>
            <div className={styles.examples} role="group" aria-label="Examples">
                {Object.entries(EXAMPLES).map(([name, example]) => (
                    <button key={name} type="button" onClick={() => setCode(example)}>
                        {name}
                    </button>
                ))}
            </div>
            <div className={styles.workspace}>
                <textarea
                    className={styles.code}
                    aria-label="Mermaid code"
                    spellCheck={false}
                    value={code}
                    placeholder={"flowchart LR\n  A[Idea] --> B[Board]"}
                    onChange={(e) => setCode(e.target.value)}
                />
                <div className={styles.preview} aria-live="polite">
                    {preview ? (
                        <StaticCanvasPreview elements={preview} width={560} height={420} className={styles.canvas} />
                    ) : (
                        <p className={parsed?.error ? styles.error : styles.empty}>{parsed?.error ?? "The board version shows here as you type."}</p>
                    )}
                </div>
            </div>
            <div className={styles.footer}>
                <span className={styles.summary}>
                    {counts &&
                        [
                            counts.shape && `${counts.shape} shapes`,
                            counts.connector && `${counts.connector} arrows`,
                            counts.frame && `${counts.frame} frames`,
                            counts.sticky && `${counts.sticky} notes`,
                        ]
                            .filter(Boolean)
                            .join(", ")}
                </span>
                <Button variant="secondary" onClick={close}>
                    Cancel
                </Button>
                <Button
                    disabled={!preview}
                    onClick={() => {
                        onPlace(parsed);
                        close();
                    }}
                >
                    Place on board
                </Button>
            </div>
        </Modal>
    );
};

export default MermaidDialog;
