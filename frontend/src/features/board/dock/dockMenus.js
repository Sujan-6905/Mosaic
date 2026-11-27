import { MENU_ITEMS } from "../tools/toolSettings";

// Things placed on the board by hand.
export const INSERTS = [
    { item: MENU_ITEMS.FRAME, label: "Frame", note: "Group a section with a title", icon: "frame" },
    { item: MENU_ITEMS.TABLE, label: "Table", note: "Rows and columns, or paste cells from a spreadsheet", icon: "table" },
    { item: MENU_ITEMS.CONNECTOR, label: "Connector", note: "An arrow that sticks to shapes", icon: "connector" },
    { item: MENU_ITEMS.IMAGE, label: "Image", note: "Upload a picture, or just paste or drop one", icon: "image" },
    { item: MENU_ITEMS.EMBED, label: "Web embed", note: "A live page, video or doc on the board", icon: "embed" },
];

export const INSERT_TOOLS = [...INSERTS.map((insert) => insert.item), MENU_ITEMS.STAMP];

// Diagrams made from a source: a sentence, a repository, Mermaid code or a saved set of parts.
export const createItems = ({ canEdit, aiEnabled, onOpenAiAssistant, onOpenArchitecture, onOpenMermaid, onOpenPieces }) => [
    ...(aiEnabled ? [{ key: "ai", label: "AI assistant", note: "Describe a diagram, or ask for a change", icon: "sparkle", onSelect: onOpenAiAssistant }] : []),
    ...(canEdit
        ? [
              {
                  key: "architecture",
                  label: "Architecture from GitHub",
                  note: "Map a repository onto the board",
                  icon: "architecture",
                  onSelect: onOpenArchitecture,
              },
              { key: "mermaid", label: "Mermaid diagram", note: "Code in, editable shapes out. Or just paste it.", icon: "code", onSelect: onOpenMermaid },
              {
                  key: "pieces",
                  label: "Pieces",
                  note: "Ready-made parts, and your own saved ones",
                  icon: "pieces",
                  shortcut: "Shift P",
                  onSelect: onOpenPieces,
              },
          ]
        : []),
];
