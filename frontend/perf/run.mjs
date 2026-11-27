import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request as playwrightRequest } from "@playwright/test";
import { FRONTEND_URL, createBoard, deleteAccount, registerAccount, signIn } from "../e2e/support/backend.js";
import { buildBoardScene } from "./boardScene.mjs";

const RESULTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "results");
const COUNTS = (process.env.PERF_COUNTS || "1000,5000,9000,20000,50000").split(",").map(Number);
const CPU_THROTTLE = Number(process.env.PERF_CPU_THROTTLE || 1);
const VIEWPORT = { width: Number(process.env.PERF_WIDTH || 1440), height: Number(process.env.PERF_HEIGHT || 810) };
const DEVICE_SCALE = Number(process.env.PERF_DPR || 2);
const SCENARIO_MS = Number(process.env.PERF_SCENARIO_MS || 3000);
const SCENARIOS = ["idle", "pan100", "zoom", "remoteEdit", "panFit"];

const argument = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? fallback : process.argv[index + 1];
};

// Each frame drives one change from inside the page, so every scenario runs at
// the same rate whatever the latency to a remote browser.
const runFrameDriver = (page, step, durationMs) =>
    page.evaluate(
        ({ stepSource, duration }) =>
            new Promise((resolve) => {
                const perf = window.__mosaicPerf;
                const apply = new Function("perf", "frame", stepSource);
                perf.reset();
                const longTasks = [];
                const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration)));
                observer.observe({ entryTypes: ["longtask"] });
                const started = performance.now();
                let frame = 0;
                const tick = () => {
                    if (performance.now() - started >= duration) {
                        observer.disconnect();
                        resolve({ ...perf.snapshot(), longTaskCount: longTasks.length, longTaskMs: Math.round(longTasks.reduce((sum, ms) => sum + ms, 0)) });
                        return;
                    }
                    apply(perf, frame++);
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }),
        { stepSource: step, duration: durationMs },
    );

const PAN_STEP = `const cam = perf.getCamera(); perf.setCamera({ ...cam, x: cam.x + (frame % 240 < 120 ? 6 : -6) / cam.zoom });`;
const ZOOM_STEP = `const cam = perf.getCamera(); const factor = frame % 120 < 60 ? 1.01 : 1 / 1.01; const { width, height } = perf.getViewportSize(); const zoom = cam.zoom * factor; perf.setCamera({ zoom, x: cam.x + (width / 2) * (1 / cam.zoom - 1 / zoom), y: cam.y + (height / 2) * (1 / cam.zoom - 1 / zoom) });`;
const REMOTE_EDIT_STEP = `const id = "perf-remote-" + (frame % 20); const cam = perf.getCamera(); const x = cam.x + 100 + (frame % 200); const y = cam.y + 100 + (frame % 20) * 20; perf.deliverSocketEvent("server:updateElement", { elementId: id, element: { type: "shape", shapeType: "Rectangle", startX: x, startY: y, endX: x + 60, endY: y + 30, color: "#3b82f6", fillColor: null, size: 2, opacity: 100, zIndex: 900000, rotation: 0, version: frame + 2 } });`;

// "fit" frames the whole board; "close" is 100% at its centre.
const cameraFor = (kind, span, { width, height }, zoomScale = 1) => {
    const zoom = (kind === "fit" ? Math.min(width, height) / (span * 1.05) : 1) * zoomScale;
    return { zoom, x: span / 2 - width / 2 / zoom, y: span / 2 - height / 2 / zoom };
};

const setCamera = (page, camera) => page.evaluate((next) => window.__mosaicPerf.setCamera(next), camera);

// How long a jump to a new view takes to fill in, and the worst frame on the way.
const measureViewFill = (page, camera) =>
    page.evaluate(
        (target) =>
            new Promise((resolve) => {
                const perf = window.__mosaicPerf;
                const started = performance.now();
                perf.setCamera(target);
                let last = started;
                let worstFrame = 0;
                const tick = (now) => {
                    worstFrame = Math.max(worstFrame, now - last);
                    last = now;
                    const finished = perf.isViewFinished() && now - started > 200;
                    if (finished || now - started > 15000) {
                        resolve({ fillMs: finished ? Math.round(now - started) : null, worstFrameMs: Math.round(worstFrame) });
                        return;
                    }
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }),
        camera,
    );

const measureBoardSize = async (page, count) => {
    const span = await page.evaluate(
        `(() => { const { elements, span } = (${buildBoardScene.toString()})(${count}); window.__mosaicPerf.loadElements(elements); return span; })()`,
    );
    await page.waitForTimeout(1500);
    const size = await page.evaluate(() => window.__mosaicPerf.getViewportSize());
    const close = cameraFor("close", span, size);
    const fit = cameraFor("fit", span, size);

    await setCamera(page, close);
    await page.waitForTimeout(400);
    const idle = await runFrameDriver(page, "", Math.min(SCENARIO_MS, 2000));
    const pan100 = await runFrameDriver(page, PAN_STEP, SCENARIO_MS);
    const zoom = await runFrameDriver(page, ZOOM_STEP, SCENARIO_MS);
    await setCamera(page, close);
    const remoteEdit = await runFrameDriver(page, REMOTE_EDIT_STEP, SCENARIO_MS);
    await setCamera(page, fit);
    await page.waitForTimeout(400);
    const panFit = await runFrameDriver(page, PAN_STEP, SCENARIO_MS);
    // Slightly off the scenario cameras, so each jump lands on a view with no tiles drawn yet.
    const fillClose = await measureViewFill(page, cameraFor("close", span, size, 1.37));
    const fillFit = await measureViewFill(page, cameraFor("fit", span, size, 0.97));
    return { count, idle, pan100, zoom, remoteEdit, panFit, fillClose, fillFit };
};

const measure = async () => {
    const api = await playwrightRequest.newContext();
    const account = await registerAccount(api, "perf");
    const board = await createBoard(api, account, "Perf board");
    // PERF_CDP_URL measures in a browser on real graphics hardware rather than headless software rendering.
    const browser = process.env.PERF_CDP_URL ? await chromium.connectOverCDP(process.env.PERF_CDP_URL) : await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE, baseURL: FRONTEND_URL });
    // A new account's tour dims the page, which would add compositing cost to every number.
    await context.addInitScript((userId) => window.localStorage.setItem(`mosaic:completedTours:${userId}`, JSON.stringify(["basics"])), account.userId);
    try {
        await signIn(context, account);
        const page = await context.newPage();
        await page.goto(`/?shareId=${board.shareId}&perf=1`);
        await page.locator('[data-room-joined="true"]').waitFor({ timeout: 20_000 });
        await page.waitForFunction(() => window.__mosaicPerf?.getViewportSize().width > 0);
        if (CPU_THROTTLE > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });

        const environment = await page.evaluate(() => {
            const gl = document.createElement("canvas").getContext("webgl2");
            const info = gl?.getExtension("WEBGL_debug_renderer_info");
            return { renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "none", width: innerWidth, height: innerHeight, dpr: devicePixelRatio };
        });
        const boards = [];
        for (const count of COUNTS) {
            console.log(`Measuring ${count} elements...`);
            boards.push(await measureBoardSize(page, count));
        }
        return { capturedAt: new Date().toISOString(), environment, cpuThrottle: CPU_THROTTLE, boards };
    } finally {
        await context.close();
        await browser.close();
        await deleteAccount(api, account);
        await api.dispose();
    }
};

const compare = (result, earlierName) => {
    const earlier = JSON.parse(readFileSync(path.join(RESULTS_DIR, `${earlierName}.json`), "utf-8"));
    for (const board of result.boards) {
        const earlierBoard = earlier.boards.find((candidate) => candidate.count === board.count);
        if (!earlierBoard) continue;
        console.log(`\n${board.count} elements, p95 frame time against ${earlierName}`);
        console.table(
            Object.fromEntries(
                SCENARIOS.map((scenario) => {
                    const [before, after] = [earlierBoard[scenario].frameTime.p95, board[scenario].frameTime.p95];
                    return [scenario, { before: before.toFixed(1), after: after.toFixed(1), ratio: before > 0 ? (after / before).toFixed(2) : "-" }];
                }),
            ),
        );
    }
};

const result = await measure();
compare(result, argument("compare", "with-tiles"));
const saveAs = argument("save");
if (saveAs) {
    writeFileSync(path.join(RESULTS_DIR, `${saveAs}.json`), JSON.stringify(result));
    console.log(`\nSaved as results/${saveAs}.json`);
}
