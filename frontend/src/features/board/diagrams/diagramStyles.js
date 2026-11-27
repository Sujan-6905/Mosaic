// The board's door into the shared diagram style engine: the same layouts and
// looks the assistant and MCP use, measured with the board's real canvas text.
import "./layoutEngine";
import { FONT_FAMILIES } from "../../../../../shared/canvas/elements/fontSources.js";
import { buildDiagram, centreDiagramOn, restyleDiagram, readDiagram } from "../../../../../shared/canvas/diagramStyles/index.js";
import { createCanvasTextMetrics } from "../rendering/canvasTextMetrics";

export { STRUCTURES, LOOKS, STRUCTURE_GROUPS, LEVERS, DEFAULT_LEVERS, structureFor, lookFor } from "../../../../../shared/canvas/diagramStyles/index.js";
export { rankStructures, structureFit } from "../../../../../shared/canvas/diagramStyles/ranking.js";
export { readDiagram, centreDiagramOn };

const metrics = () => createCanvasTextMetrics(FONT_FAMILIES[0]);

// The content of an assistant turn, apart from how it is drawn.
export const diagramOf = ({ title, nodes, edges, groups }) => ({ title: title ?? null, nodes: nodes ?? [], edges: edges ?? [], groups: groups ?? [] });

export const recipeOf = (style) => (style ? { structure: style.structure, look: style.look, levers: style.levers ?? {} } : {});

export const buildStyledDiagram = ({ diagram, recipe, generateElementId }) => buildDiagram({ model: diagram, recipe, metrics: metrics(), generateElementId });

export const restyleSelection = ({ elements, ids, recipe, generateElementId }) =>
    restyleDiagram({ elements, ids, recipe, metrics: metrics(), generateElementId });

// A built diagram as the plain { id: element } map previews draw from.
export const previewElementsFor = (diagram, recipe) => {
    let n = 0;
    const built = buildStyledDiagram({ diagram, recipe, generateElementId: () => `preview-${n++}` });
    return Object.fromEntries(built.elements.map(({ elementId, element }) => [elementId, element]));
};
