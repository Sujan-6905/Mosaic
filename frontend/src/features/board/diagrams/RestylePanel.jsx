import { useEffect, useMemo, useRef, useState } from "react";
import StrokeIcon from "@/components/ui/StrokeIcon";
import Tabs from "@/components/ui/Tabs";
import Select from "@/components/ui/Select";
import StaticCanvasPreview from "../rendering/StaticCanvasPreview";
import {
    DEFAULT_LEVERS,
    LEVERS,
    LOOKS,
    STRUCTURES,
    STRUCTURE_GROUPS,
    lookFor,
    previewElementsFor,
    rankStructures,
    readDiagram,
    structureFor,
} from "./diagramStyles";
import styles from "./RestylePanel.module.css";

const TABS = [
    { value: "structure", label: "Structure" },
    { value: "look", label: "Look" },
    { value: "customise", label: "Customise" },
];
const SUGGESTED_COUNT = 6;
const TILE_WIDTH = 150;
const TILE_HEIGHT = 96;

// Renders its preview only once scrolled into view, so 72 structures or 43
// looks don't all lay out the moment the panel opens.
function LazyPreview({ diagram, recipe }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const node = ref.current;
        if (!node || visible) return undefined;
        const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setVisible(true), { rootMargin: "120px" });
        observer.observe(node);
        return () => observer.disconnect();
    }, [visible]);
    const elements = useMemo(() => (visible ? previewElementsFor(diagram, recipe) : null), [visible, diagram, recipe]);
    return (
        <span ref={ref} className={styles.preview}>
            {elements && (
                <StaticCanvasPreview
                    elements={elements}
                    background={{ type: "blank", colorToken: null }}
                    width={TILE_WIDTH}
                    height={TILE_HEIGHT}
                    className={styles.canvas}
                />
            )}
        </span>
    );
}

function Tile({ name, detail, current, onPick, diagram, recipe }) {
    return (
        <li>
            <button type="button" className={styles.tile} aria-pressed={current} onClick={onPick} title={detail}>
                <LazyPreview diagram={diagram} recipe={recipe} />
                <span className={styles.tileName}>{name}</span>
            </button>
        </li>
    );
}

const leverValue = (value) => String(value);

// Restyles any selected diagram, however it was made: a structure re-lays it out, a look or lever repaints it.
export default function RestylePanel({ isOpen, onClose, elements, selectedElementIds, onApply }) {
    const [tab, setTab] = useState("structure");
    const [query, setQuery] = useState("");
    const [group, setGroup] = useState(STRUCTURE_GROUPS[0]);
    const read = useMemo(() => (isOpen ? readDiagram(elements, selectedElementIds) : null), [isOpen, elements, selectedElementIds]);
    const diagram = read?.model;
    const usable = Boolean(diagram?.nodes?.length);
    const suggested = useMemo(() => (usable ? rankStructures("", diagram, SUGGESTED_COUNT) : []), [usable, diagram]);
    const recipe = useMemo(
        () => ({
            structure: read?.recipe?.structure ?? suggested[0] ?? STRUCTURES[0].id,
            look: read?.recipe?.look ?? LOOKS[0].id,
            levers: read?.recipe?.levers ?? {},
        }),
        [read, suggested],
    );

    if (!isOpen) return null;
    const levers = { ...DEFAULT_LEVERS, ...lookFor(recipe.look).levers, ...recipe.levers };
    const search = query.trim().toLowerCase();
    const structuresShown = search
        ? STRUCTURES.filter((structure) => `${structure.name} ${structure.bestFor} ${structure.group}`.toLowerCase().includes(search))
        : STRUCTURES.filter((structure) => structure.group === group);
    const looksShown = search ? LOOKS.filter((look) => `${look.name} ${look.summary}`.toLowerCase().includes(search)) : LOOKS;

    return (
        <aside className={styles.panel} aria-label="Restyle diagram" data-board-chrome>
            <header className={styles.header}>
                <h2 className={styles.title}>Restyle</h2>
                <button type="button" className={styles.iconButton} aria-label="Close restyle" onClick={onClose}>
                    <StrokeIcon name="close" size={16} />
                </button>
            </header>
            {!usable ? (
                <p className={styles.empty}>Select a diagram: boxes joined by arrows, or anything the assistant, Mermaid or a GitHub import drew.</p>
            ) : (
                <>
                    <p className={styles.current}>
                        <span>{structureFor(recipe.structure).name}</span>
                        <span aria-hidden="true">in</span>
                        <span>{lookFor(recipe.look).name}</span>
                    </p>
                    <div className={styles.tabs}>
                        <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Restyle options" />
                    </div>
                    {tab !== "customise" && (
                        <input
                            className={styles.search}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={tab === "structure" ? "Search 72 structures" : "Search 43 looks"}
                            aria-label={tab === "structure" ? "Search structures" : "Search looks"}
                        />
                    )}
                    <div className={styles.body}>
                        {tab === "structure" && (
                            <>
                                {!search && (
                                    <section aria-label="Suggested for this content">
                                        <h3 className={styles.sectionTitle}>Suggested for this content</h3>
                                        <ul className={styles.grid}>
                                            {suggested.map((id) => (
                                                <Tile
                                                    key={id}
                                                    name={structureFor(id).name}
                                                    detail={structureFor(id).summary}
                                                    current={id === recipe.structure}
                                                    diagram={diagram}
                                                    recipe={{ ...recipe, structure: id }}
                                                    onPick={() => onApply({ structure: id })}
                                                />
                                            ))}
                                        </ul>
                                        <div className={styles.groupPicker}>
                                            <Select
                                                value={group}
                                                onChange={setGroup}
                                                options={STRUCTURE_GROUPS.map((name) => ({ value: name, label: name }))}
                                                ariaLabel="Structure family"
                                                className="w-full"
                                            />
                                        </div>
                                    </section>
                                )}
                                <ul className={styles.grid}>
                                    {structuresShown.map((structure) => (
                                        <Tile
                                            key={structure.id}
                                            name={`${structure.number}. ${structure.name}`}
                                            detail={structure.summary}
                                            current={structure.id === recipe.structure}
                                            diagram={diagram}
                                            recipe={{ ...recipe, structure: structure.id }}
                                            onPick={() => onApply({ structure: structure.id })}
                                        />
                                    ))}
                                </ul>
                            </>
                        )}
                        {tab === "look" && (
                            <ul className={styles.grid}>
                                {looksShown.map((look) => (
                                    <Tile
                                        key={look.id}
                                        name={`${look.number}. ${look.name}`}
                                        detail={look.summary}
                                        current={look.id === recipe.look}
                                        diagram={diagram}
                                        recipe={{ ...recipe, look: look.id, levers: {} }}
                                        onPick={() => onApply({ look: look.id, levers: {} })}
                                    />
                                ))}
                            </ul>
                        )}
                        {tab === "customise" && (
                            <ul className={styles.levers}>
                                {LEVERS.map((lever) => (
                                    <li key={lever.id} className={styles.lever}>
                                        <span className={styles.leverName}>{lever.name}</span>
                                        <Select
                                            value={leverValue(levers[lever.id])}
                                            onChange={(value) =>
                                                onApply({
                                                    levers: { ...recipe.levers, [lever.id]: lever.options.find((option) => leverValue(option) === value) },
                                                })
                                            }
                                            options={lever.options.map((option, index) => ({ value: leverValue(option), label: lever.labels[index] }))}
                                            ariaLabel={lever.name}
                                            className="w-full"
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </aside>
    );
}
