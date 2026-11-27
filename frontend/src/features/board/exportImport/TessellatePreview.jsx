import { useEffect } from "react";
import { drawStone, rank } from "@/components/stoneScene/stones";
import { sampleStones, stoneHalf } from "./tessellate";
import { useStoneScene } from "@/components/stoneScene/useStoneScene";
import styles from "./TessellatePreview.module.css";

const PREVIEW_W = 720;
const PREVIEW_H = 300;

// The board's stones sweep back and forth over it, showing the poster laid from the board's own pixels;
// moving the pointer across it takes over the sweep.
class TessellateScene {
    width = PREVIEW_W;
    height = PREVIEW_H;

    constructor({ calm }) {
        this.still = calm;
        this.sweep = calm ? 1.2 : -0.1;
        this.dir = 1;
        this.hold = 0;
        this.aim = null;
        this.board = null;
        this.layout = null;
    }

    setBoard(raster, cell) {
        const fit = Math.min(PREVIEW_W / raster.width, PREVIEW_H / raster.height);
        const board = document.createElement("canvas");
        board.width = Math.max(1, Math.round(raster.width * fit));
        board.height = Math.max(1, Math.round(raster.height * fit));
        board.getContext("2d").drawImage(raster, 0, 0, board.width, board.height);
        this.board = board;
        this.layout = sampleStones(board, Math.max(4, cell * fit));
        this.offsetX = (PREVIEW_W - this.layout.cols * this.layout.cell) / 2;
        this.offsetY = (PREVIEW_H - this.layout.rows * this.layout.cell) / 2;
        this.boardX = (PREVIEW_W - board.width) / 2;
        this.boardY = (PREVIEW_H - board.height) / 2;
    }

    pointer(x) {
        this.aim = x;
    }

    leave() {
        this.aim = null;
    }

    step(dt) {
        if (this.still) return;
        if (this.aim !== null) {
            const want = (this.aim - this.offsetX) / Math.max(1, this.layout?.cols * this.layout?.cell);
            this.sweep += (Math.max(-0.1, Math.min(1.2, want)) - this.sweep) * (1 - Math.exp(-10 * dt));
        } else if (this.hold > 0) this.hold -= dt;
        else {
            this.sweep += this.dir * dt * 0.38;
            if (this.sweep > 1.2) {
                this.dir = -1;
                this.hold = 2.4;
            }
            if (this.sweep < -0.12) {
                this.dir = 1;
                this.hold = 0.8;
            }
        }
    }

    draw(g) {
        g.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
        if (!this.layout) return;
        g.drawImage(this.board, this.boardX, this.boardY);
        const { cell, cols, rows, stones } = this.layout;
        const half = stoneHalf(cell);
        for (const stone of stones) {
            const along = (stone.col + 0.5) / cols + rank(stone.index + 11) * 0.06 + (stone.row / rows) * 0.05;
            const p = (this.sweep - along) / 0.11;
            if (p <= 0) continue;
            const k = Math.min(1, p);
            const land = 1 - Math.pow(1 - k, 3);
            const x = this.offsetX + (stone.col + 0.5) * cell;
            const y = this.offsetY + (stone.row + 0.5) * cell;
            g.fillStyle = "#0b0c0f";
            g.fillRect(x - cell / 2, y - cell / 2, cell + 0.5, cell + 0.5);
            drawStone(g, {
                x,
                y: y - (1 - land) * cell * 1.4,
                half: half * (1.5 - 0.5 * land),
                cut: stone.cut,
                color: stone.color,
                rot: (1 - land) * (rank(stone.index) - 0.5) * 2.4,
                alpha: Math.min(1, k * 2.5),
                shine: (1 - land) * 0.5,
            });
        }
    }
}

export default function TessellatePreview({ raster, cell }) {
    const { canvasRef, sceneRef } = useStoneScene((options) => new TessellateScene(options));

    useEffect(() => {
        if (raster) sceneRef.current?.setBoard(raster, cell);
    }, [raster, cell, sceneRef]);

    return <canvas ref={canvasRef} className={styles.preview} aria-label="The board being laid as a mosaic. Move across it to sweep the stones by hand." />;
}
