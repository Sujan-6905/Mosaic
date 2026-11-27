import { GETTING_STARTED_ARTICLES } from "./gettingStarted";
import { ON_THE_BOARD_ARTICLES } from "./onTheBoard";
import { TOGETHER_ARTICLES } from "./together";
import { AI_ARTICLES, HISTORY_ARTICLES } from "./historyAndAi";
import { AGENT_ARTICLES } from "./agents";
import { BEYOND_ARTICLES } from "./beyondTheBoard";
import { UNDER_THE_HOOD_ARTICLES } from "./underTheHood";

// Each docs slug to the component that writes its page.
export const ARTICLES = {
    ...GETTING_STARTED_ARTICLES,
    ...ON_THE_BOARD_ARTICLES,
    ...TOGETHER_ARTICLES,
    ...HISTORY_ARTICLES,
    ...AI_ARTICLES,
    ...AGENT_ARTICLES,
    ...BEYOND_ARTICLES,
    ...UNDER_THE_HOOD_ARTICLES,
};
