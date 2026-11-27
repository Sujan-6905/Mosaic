// Draws the board through cached bitmap tiles, one grid per zoom level, so panning only composites images.
// A tile redraws when missing or edited, and drawing per frame is capped so a busy view fills in gradually.
export const TILE_PX = 512;
const MAX_TILES = 192;
const ELEMENTS_PER_FRAME = 600;
const ZOOM_SETTLE_MS = 150;
// While a zoom is moving, tiles stretch this far before a new level is started.
const MAX_STRETCH = 2;
// Element bounds leave out stroke width and sticky shadows, so a tile also
// draws whatever sits just outside it.
const INK_PADDING_WORLD = 40;
const INK_PADDING_PX = 12;

const scaleKey = (scale) => scale.toFixed(4);

// Every version a change affects, old and new, since both sit on tiles to redraw.
// `candidateIds` narrows the comparison; elements already drawn onto their tiles need nothing.
export const findChangedElements = (previous, next, alreadyOnTiles, candidateIds = null) => {
    const changed = [];
    const compare = (id) => {
        const painted = alreadyOnTiles.get(id);
        if (painted ? painted === next[id] : previous[id] === next[id]) return;
        if (previous[id]) changed.push(previous[id]);
        if (painted && painted !== previous[id]) changed.push(painted);
        if (next[id]) changed.push(next[id]);
    };
    if (candidateIds) {
        candidateIds.forEach(compare);
    } else {
        for (const id in next) compare(id);
        for (const id in previous) if (!(id in next)) compare(id);
    }
    // Painted straight onto a tile since the last snapshot, so neither snapshot may know it.
    alreadyOnTiles.forEach((_, id) => {
        if (!(id in next) && !(id in previous) && !candidateIds?.has?.(id)) compare(id);
    });
    return changed;
};

export const createTileRenderer = ({ collectElements, paintElements, createCanvas, now = () => performance.now() }) => {
    const levels = new Map();
    let activeLevel = null;
    let lastScale = null;
    let lastScaleChangeAt = 0;
    let frame = 0;

    const levelFor = (scale, zoom) => {
        const key = scaleKey(scale);
        if (!levels.has(key)) levels.set(key, { key, scale, zoom, tiles: new Map() });
        return levels.get(key);
    };

    const tileWorldSize = (level) => TILE_PX / level.scale;
    const paddingFor = (level) => INK_PADDING_WORLD + INK_PADDING_PX / level.scale;

    const forEachTileIndexIn = (level, bounds, visit) => {
        const size = tileWorldSize(level);
        const padding = paddingFor(level);
        const lastX = Math.floor((bounds.maxX + padding) / size);
        const lastY = Math.floor((bounds.maxY + padding) / size);
        for (let y = Math.floor((bounds.minY - padding) / size); y <= lastY; y++) {
            for (let x = Math.floor((bounds.minX - padding) / size); x <= lastX; x++) visit(x, y);
        }
    };

    const rasterize = (level, tile) => {
        const size = tileWorldSize(level);
        const padding = paddingFor(level);
        const entries = collectElements({
            minX: tile.x * size - padding,
            minY: tile.y * size - padding,
            maxX: (tile.x + 1) * size + padding,
            maxY: (tile.y + 1) * size + padding,
        });
        tile.stale = false;
        tile.ready = true;
        tile.maxZIndex = -Infinity;
        if (entries.length === 0) {
            tile.canvas = null;
            tile.context = null;
            return 0;
        }
        if (!tile.canvas) {
            tile.canvas = createCanvas(TILE_PX, TILE_PX);
            tile.context = tile.canvas.getContext("2d");
        }
        const { context } = tile;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, TILE_PX, TILE_PX);
        context.setTransform(level.scale, 0, 0, level.scale, -tile.x * TILE_PX, -tile.y * TILE_PX);
        paintElements(context, entries, level.zoom);
        tile.maxZIndex = entries[entries.length - 1][1].zIndex ?? 0;
        return entries.length;
    };

    const tileAt = (level, x, y) => {
        const key = `${x},${y}`;
        let tile = level.tiles.get(key);
        if (!tile) {
            tile = { key, x, y, canvas: null, context: null, stale: false, ready: false, maxZIndex: -Infinity, lastUsedFrame: frame };
            level.tiles.set(key, tile);
        }
        return tile;
    };

    const visibleTiles = (level, camera, viewportWidth, viewportHeight) => {
        const size = tileWorldSize(level);
        const tiles = [];
        const lastX = Math.floor((camera.x + viewportWidth / camera.zoom) / size);
        const lastY = Math.floor((camera.y + viewportHeight / camera.zoom) / size);
        for (let y = Math.floor(camera.y / size); y <= lastY; y++) {
            for (let x = Math.floor(camera.x / size); x <= lastX; x++) tiles.push(tileAt(level, x, y));
        }
        return tiles;
    };

    // Edited tiles first, since they're showing something untrue; then the
    // view's centre outward, where the eye is.
    const byDrawPriority = (level, camera, viewportWidth, viewportHeight) => {
        const size = tileWorldSize(level);
        const centerX = (camera.x + viewportWidth / camera.zoom / 2) / size - 0.5;
        const centerY = (camera.y + viewportHeight / camera.zoom / 2) / size - 0.5;
        const distance = (tile) => (tile.x - centerX) ** 2 + (tile.y - centerY) ** 2;
        return (a, b) => Number(b.stale) - Number(a.stale) || distance(a) - distance(b);
    };

    const drawTile = (context, level, tile, camera, dpr) => {
        tile.lastUsedFrame = frame;
        if (!tile.canvas) return;
        const scale = camera.zoom * dpr;
        if (level.scale === scale) {
            context.drawImage(tile.canvas, Math.round(-camera.x * scale) + tile.x * TILE_PX, Math.round(-camera.y * scale) + tile.y * TILE_PX);
            return;
        }
        const size = tileWorldSize(level);
        const left = Math.floor((tile.x * size - camera.x) * scale);
        const top = Math.floor((tile.y * size - camera.y) * scale);
        const right = Math.ceil(((tile.x + 1) * size - camera.x) * scale);
        const bottom = Math.ceil(((tile.y + 1) * size - camera.y) * scale);
        context.drawImage(tile.canvas, left, top, right - left, bottom - top);
    };

    // Stands in for an unfinished tile with whatever another zoom level already has there.
    const drawFallback = (context, level, tile, camera, dpr) => {
        const size = tileWorldSize(level);
        const bounds = { minX: tile.x * size, minY: tile.y * size, maxX: (tile.x + 1) * size, maxY: (tile.y + 1) * size };
        for (const other of levels.values()) {
            if (other === level) continue;
            const otherSize = tileWorldSize(other);
            for (let y = Math.floor(bounds.minY / otherSize); y * otherSize < bounds.maxY; y++) {
                for (let x = Math.floor(bounds.minX / otherSize); x * otherSize < bounds.maxX; x++) {
                    const candidate = other.tiles.get(`${x},${y}`);
                    if (candidate?.ready && !candidate.stale) drawTile(context, other, candidate, camera, dpr);
                }
            }
        }
    };

    const evictOldTiles = () => {
        const all = [];
        for (const level of levels.values()) {
            for (const tile of level.tiles.values()) if (tile.ready) all.push([level, tile]);
        }
        if (all.length <= MAX_TILES) return;
        all.sort(([, a], [, b]) => a.lastUsedFrame - b.lastUsedFrame);
        for (const [level, tile] of all.slice(0, all.length - MAX_TILES)) {
            if (tile.lastUsedFrame === frame) break;
            level.tiles.delete(tile.key);
        }
        for (const [key, level] of levels) {
            if (level !== activeLevel && level.tiles.size === 0) levels.delete(key);
        }
    };

    const chooseActiveLevel = (scale, zoom) => {
        const time = now();
        if (scale !== lastScale) {
            lastScale = scale;
            lastScaleChangeAt = time;
        }
        const settled = time - lastScaleChangeAt >= ZOOM_SETTLE_MS;
        const stretch = activeLevel ? scale / activeLevel.scale : Infinity;
        if (settled || !activeLevel || stretch > MAX_STRETCH || stretch < 1 / MAX_STRETCH) activeLevel = levelFor(scale, zoom);
        return settled;
    };

    // Returns whether the view is final; if it isn't, the caller should
    // composite again next frame to keep filling it in.
    const composite = (context, camera, dpr, viewportWidth, viewportHeight) => {
        frame += 1;
        const settled = chooseActiveLevel(camera.zoom * dpr, camera.zoom);
        const level = activeLevel;
        const visible = visibleTiles(level, camera, viewportWidth, viewportHeight);

        let budget = ELEMENTS_PER_FRAME;
        const unfinished = visible.filter((tile) => !tile.ready || tile.stale).sort(byDrawPriority(level, camera, viewportWidth, viewportHeight));
        let drawnCount = 0;
        for (const tile of unfinished) {
            if (budget <= 0) break;
            budget -= rasterize(level, tile);
            drawnCount += 1;
        }
        const finished = drawnCount === unfinished.length;

        context.setTransform(1, 0, 0, 1, 0, 0);
        for (const tile of visible) {
            if (tile.ready) drawTile(context, level, tile, camera, dpr);
            else drawFallback(context, level, tile, camera, dpr);
        }

        // Spare budget goes on the ring just outside the view, so a pan usually
        // arrives at tiles that are already there.
        let ringComplete = true;
        if (finished && settled) {
            const margin = tileWorldSize(level);
            const ring = visibleTiles(
                level,
                { x: camera.x - margin, y: camera.y - margin, zoom: camera.zoom },
                viewportWidth + 2 * margin * camera.zoom,
                viewportHeight + 2 * margin * camera.zoom,
            ).filter((tile) => !tile.ready || tile.stale);
            for (const tile of ring.sort(byDrawPriority(level, camera, viewportWidth, viewportHeight))) {
                if (budget <= 0) {
                    ringComplete = false;
                    break;
                }
                budget -= rasterize(level, tile);
                tile.lastUsedFrame = frame;
            }
        }

        evictOldTiles();
        return finished && settled && ringComplete;
    };

    const invalidateBounds = (bounds) => {
        for (const level of levels.values()) {
            forEachTileIndexIn(level, bounds, (x, y) => {
                const key = `${x},${y}`;
                if (level === activeLevel) {
                    const tile = level.tiles.get(key);
                    if (tile?.ready) tile.stale = true;
                } else {
                    level.tiles.delete(key);
                }
            });
        }
    };

    const invalidateAll = () => {
        for (const [key, level] of levels) {
            if (level === activeLevel)
                level.tiles.forEach((tile) => {
                    tile.stale = tile.ready;
                });
            else levels.delete(key);
        }
    };

    // A new element usually lands on top of everything, so a finished tile can
    // take it directly. One that belongs underneath needs the tile redrawn.
    const addToTop = (entry, bounds) => {
        const zIndex = entry[1].zIndex ?? 0;
        for (const level of levels.values()) {
            forEachTileIndexIn(level, bounds, (x, y) => {
                const key = `${x},${y}`;
                const tile = level.tiles.get(key);
                if (!tile?.ready) return;
                if (level !== activeLevel) {
                    level.tiles.delete(key);
                } else if (tile.stale || zIndex < tile.maxZIndex) {
                    tile.stale = true;
                } else {
                    if (!tile.canvas) {
                        tile.canvas = createCanvas(TILE_PX, TILE_PX);
                        tile.context = tile.canvas.getContext("2d");
                        tile.context.setTransform(level.scale, 0, 0, level.scale, -tile.x * TILE_PX, -tile.y * TILE_PX);
                    }
                    paintElements(tile.context, [entry], level.zoom);
                    tile.maxZIndex = zIndex;
                }
            });
        }
    };

    return { composite, invalidateBounds, invalidateAll, addToTop };
};
