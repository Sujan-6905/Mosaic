// Per-layer switches, read once at import from GROUNDING_DISABLED_LAYERS for the ablation
// study. Every layer is on by default; disabling one is not a deployment setting.
const LAYER_KEYS = {
    CONTEXT: "context", // Cross-cutting: whether the assistant receives board state at all
    GROUPING: "grouping", // structural and temporal grouping into addressable objects
    TEMPORAL_GROUPING: "temporal-grouping", // the op-log burst signal alone
    RELATIONS: "relations", // relation graph and label attachment
    RESOLVER: "resolver", // hybrid reference resolver
};

const disabled = new Set(
    (process.env.GROUNDING_DISABLED_LAYERS || "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean),
);

export const isLayerEnabled = (layer) => !disabled.has(layer);

export { LAYER_KEYS };
