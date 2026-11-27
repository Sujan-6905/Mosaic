import Link from "next/link";
import LiveDiagram from "@/features/site/howItWorks/LiveDiagram";
import { DECISIONS, SOURCE_URL } from "@/features/site/siteContent";
import { CodeBlock, Section } from "./primitives";
import HiddenDetails from "./HiddenDetails";
import styles from "./underTheHood.module.css";

const SELF_HOSTING_GUIDE = `${SOURCE_URL}/blob/main/docs/self-hosting.md`;

function Architecture({ onSignIn }) {
    return (
        <>
            <p>
                Mosaic is four parts: a Next.js frontend, an Express and Socket.io backend, a shared board model both of them import, and an MCP server that
                lets agents in. The diagram below is drawn by the board&apos;s own renderer: drag to pan, pinch or Ctrl and scroll to zoom.
            </p>
            <figure className={`site-theme ${styles.plate}`}>
                <LiveDiagram id="system" title="How Mosaic's parts connect" onSignIn={onSignIn} />
            </figure>

            <Section id="client" title="The client">
                <p>
                    The board paints committed elements on a static layer outside React and in-progress strokes on an overlay. A spatial index answers what is
                    on screen, and finished regions are cached as bitmap tiles, so a repaint costs what the viewport shows rather than what the board holds.
                </p>
            </Section>

            <Section id="live-rooms" title="Live rooms">
                <p>
                    Every open board is a room on the backend. The server stamps each accepted change to a shape with a new version, and a screen only applies a
                    version newer than the one it holds, so everyone ends on the same board. Text inside a shape merges instead, so two people typing keep both.
                    With Redis configured, rooms live outside any one server, so instances are interchangeable.
                </p>
            </Section>

            <Section id="storage" title="Storage and history">
                <p>
                    Boards are stored in Couchbase. Every change is also appended to an operation log with periodic snapshots, and version history, replay and
                    branch diffs are all readings of that one log. Measured against MongoDB on the same paths, Couchbase keeps many people writing to one board
                    fast, while MongoDB answers queries faster; the comparison is on How it works.
                </p>
            </Section>

            <Section id="assistant" title="The assistant">
                <p>
                    The model never places anything. For a new diagram it returns nodes and edges, and a layout engine in the browser computes every position.
                    For an edit, Mosaic first describes the board as a graph of named objects and their relations, the model refers to those names, and each
                    proposed edit is checked on a copy of the board before you see it. The model&apos;s key stays on the server. Run on eleven models, that
                    split drew more of each diagram&apos;s connections than asking the model for coordinates, with no labels covering each other; the comparison
                    is on How it works.
                </p>
            </Section>

            <Section id="decisions" title="The decisions behind it">
                <ul>
                    {DECISIONS.map((decision) => (
                        <li key={decision.id}>
                            <strong>{decision.kicker}</strong>: {decision.title}.
                        </li>
                    ))}
                </ul>
                <p>
                    Each one is explained, with its own live diagram, on <Link href="/about#decisions">How it works</Link>.
                </p>
            </Section>
        </>
    );
}

function SelfHosting() {
    return (
        <>
            <p>
                Mosaic is open source under the MIT license. It needs Node.js 24 or Docker and a Couchbase Capella cluster, where the free tier is enough.
                Redis, a model key, image storage and browser notifications are optional, and each one only switches a feature on.
            </p>

            <Section id="docker" title="With Docker">
                <CodeBlock label="Terminal" code={"cp backend/.env.example backend/.env\ncp frontend/.env.example frontend/.env\ndocker compose up --build"} />
                <p>Fill in the two .env files first; each setting is explained where it is listed.</p>
            </Section>

            <Section id="hosted" title="On Vercel and Render">
                <p>
                    The reference deployment runs the frontend on Vercel and the backend on Render, both on free plans. The repository includes a Render
                    blueprint, <code>render.yaml</code>, and the frontend deploys from the <code>frontend</code> folder. A free Render service sleeps when idle,
                    so the site wakes it as soon as anyone visits and says so while it starts.
                </p>
            </Section>

            <Section id="guide" title="The full guide">
                <p>
                    Every setting, scaling to several instances behind nginx, and the operations dashboard are covered in the{" "}
                    <a href={SELF_HOSTING_GUIDE} target="_blank" rel="noreferrer">
                        self-hosting guide
                    </a>{" "}
                    in the source.
                </p>
            </Section>
        </>
    );
}

function HiddenDetailsPage() {
    return (
        <>
            <p>
                Mosaic is named after a picture made of small pieces, and a few small pieces are hidden around it. None of them gets in the way; calm mode turns
                every one of them into a quiet fade. Turn a tile over to see where it is.
            </p>
            <HiddenDetails />
        </>
    );
}

export const UNDER_THE_HOOD_ARTICLES = { architecture: Architecture, "self-hosting": SelfHosting, "hidden-details": HiddenDetailsPage };
