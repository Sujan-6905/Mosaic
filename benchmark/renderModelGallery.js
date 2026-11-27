#!/usr/bin/env node
// One image per task from the model benchmark's saved drawings: a row per model, the first version beside
// today's, written to results/gallery/ with results/model-gallery.md to show them. Run after the benchmark.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requireFromFrontend } from "./packageResolution.js";
import { TASKS } from "./models/tasks.js";
import { VARIANTS } from "./models/variants.js";
import { modelLabel } from "./models/providers.js";

const { chromium } = requireFromFrontend("@playwright/test");
const RESULTS_DIR = new URL("./results/", import.meta.url).pathname;
const MODELS_DIR = join(RESULTS_DIR, "models");
const GALLERY_DIR = join(RESULTS_DIR, "gallery");

const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

const readRecord = (dir, name) => {
    const path = join(MODELS_DIR, dir, `${name}.json`);
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
};

const cell = (dir, name) => {
    const record = readRecord(dir, name);
    if (!record) return `<div class="cell empty">not run</div>`;
    if (!record.grade.drawn) return `<div class="cell empty">${escapeHtml(record.outcome)}</div>`;
    const svg = readFileSync(join(MODELS_DIR, dir, `${name}.svg`)).toString("base64");
    return `<div class="cell"><img src="data:image/svg+xml;base64,${svg}" alt=""></div>`;
};

const sheetHtml = (task, dirs) => `<!doctype html><html><head><style>
    body { margin: 0; padding: 24px; background: #ffffff; font: 14px/1.4 Helvetica, Arial, sans-serif; color: #1f2937; width: 1040px; }
    h1 { font-size: 17px; margin: 0 0 16px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 220px 1fr 1fr; gap: 8px; }
    .head { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .model { align-self: center; font-weight: 600; font-size: 13px; overflow-wrap: anywhere; }
    .cell { height: 220px; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f6f6f3; overflow: hidden; }
    .cell img { max-width: 100%; max-height: 100%; }
    .empty { color: #9ca3af; font-size: 13px; }
</style></head><body>
    <h1>${escapeHtml(task.prompt)}</h1>
    <div class="grid">
        <div></div>${Object.values(VARIANTS)
            .map((variant) => `<div class="head">${escapeHtml(variant.label)}</div>`)
            .join("")}
        ${dirs
            .map(
                ({ dir, label }) =>
                    `<div class="model">${escapeHtml(label)}</div>${Object.keys(VARIANTS)
                        .map((variant) => cell(dir, `${task.id}.${variant}`))
                        .join("")}`,
            )
            .join("")}
    </div>
</body></html>`;

const dirs = readdirSync(MODELS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
        const record = readdirSync(join(MODELS_DIR, entry.name)).find((file) => file.endsWith(".json"));
        const modelKey = record ? JSON.parse(readFileSync(join(MODELS_DIR, entry.name, record), "utf8")).modelKey : entry.name;
        return { dir: entry.name, label: modelLabel(modelKey) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

mkdirSync(GALLERY_DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1088, height: 800 } });
for (const task of TASKS) {
    await page.setContent(sheetHtml(task, dirs), { waitUntil: "load" });
    await page.screenshot({ path: join(GALLERY_DIR, `${task.id}.jpg`), type: "jpeg", quality: 82, fullPage: true });
    console.log(`  ${task.id}.jpg`);
}
await browser.close();

const gallery = [
    "# Assistant model benchmark: every drawing",
    "",
    "Each image is one task. Every model drew it twice: through the assistant's first version (raw coordinates on a",
    "fixed grid) and through Mosaic today (typed intents, the diagram style engine and named sketch parts). The numbers",
    "behind these are in [model-benchmark.md](model-benchmark.md), and `node benchmark/renderModelGallery.js` redraws them",
    "from the saved results. These images draw each connector straight between its ends; on a board, a routed link",
    "bends around the cards in its way.",
    "",
    ...TASKS.flatMap((task) => [`## ${task.prompt}`, "", `![${task.id}](gallery/${task.id}.jpg)`, ""]),
];
writeFileSync(join(RESULTS_DIR, "model-gallery.md"), `${gallery.join("\n")}`);
console.log(`\n${TASKS.length} images in benchmark/results/gallery, shown in benchmark/results/model-gallery.md`);
