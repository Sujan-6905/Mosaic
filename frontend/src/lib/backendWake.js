import { setBackendStatus } from "@/store/connectionSlice";

const PROBE_TIMEOUT_MS = 5_000;
const RETRY_MS = 5_000;
// Catches a free-tier backend that went back to sleep while nothing else was talking to it.
const HEARTBEAT_MS = 30_000;
// A cold start usually takes under a minute and can take up to five.
const GIVE_UP_AFTER_MS = 6 * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const backendAnswers = async () => {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/config`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), cache: "no-store" });
        return response.ok;
    } catch {
        return false;
    }
};

// A hidden tab stops heartbeating, so a forgotten tab doesn't keep the server awake.
const untilVisible = () =>
    document.visibilityState === "visible"
        ? Promise.resolve()
        : new Promise((resolve) => {
              const onChange = () => {
                  if (document.visibilityState !== "visible") return;
                  document.removeEventListener("visibilitychange", onChange);
                  resolve();
              };
              document.addEventListener("visibilitychange", onChange);
          });

let monitoring = false;

// Probes until the backend answers, then heartbeats; the first probe is also what wakes a sleeping server.
const monitor = async (dispatch) => {
    if (monitoring) return;
    monitoring = true;
    let downSince = null;
    try {
        for (;;) {
            if (await backendAnswers()) {
                downSince = null;
                dispatch(setBackendStatus("ready"));
                await sleep(HEARTBEAT_MS);
                await untilVisible();
                continue;
            }
            downSince ??= Date.now();
            if (Date.now() - downSince >= GIVE_UP_AFTER_MS) {
                dispatch(setBackendStatus("unreachable"));
                return;
            }
            dispatch(setBackendStatus("waking"));
            await sleep(RETRY_MS);
        }
    } finally {
        monitoring = false;
    }
};

export const watchBackend = (dispatch) => {
    if (!process.env.NEXT_PUBLIC_API_URL) return;
    monitor(dispatch);
};
