import useMediaQuery from "@/hooks/useMediaQuery";

// Phones in either orientation: too narrow for the full dock, or too short for bars above and below the board.
// CSS uses the same condition as `@media (max-width: 720px), (max-height: 500px)`.
export const COMPACT_BOARD_QUERY = "(max-width: 720px), (max-height: 500px)";

export default function useCompactBoard() {
    return useMediaQuery(COMPACT_BOARD_QUERY);
}
