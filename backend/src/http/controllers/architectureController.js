import Drawing from "../../models/drawingSchema.js";
import { parseRepositoryUrl, readRepositoryFiles, resolveCommit, resolvePullRequest, RepositoryError } from "../../architecture/githubRepo.js";
import { diffModuleGraphs } from "../../architecture/moduleGraph.js";
import { buildModuleGraphIsolated } from "../../architecture/buildGraphIsolated.js";
import { explainGraph } from "../../architecture/explainGraph.js";
import logger from "../../observability/logger.js";

const CACHE_SIZE = 20;
const graphCache = new Map();

// A commit never changes, so its graph can be kept. Bounded, oldest out first.
const remember = (key, value) => {
    graphCache.delete(key);
    graphCache.set(key, value);
    if (graphCache.size > CACHE_SIZE) graphCache.delete(graphCache.keys().next().value);
    return value;
};

const graphAt = async ({ owner, repo, sha }) => {
    const key = `graph:${owner}/${repo}@${sha}`;
    return graphCache.get(key) ?? remember(key, await buildModuleGraphIsolated(await readRepositoryFiles({ owner, repo, sha })));
};

// Always tries the model. If it can't answer, the diagram is still correct with
// folder names, so the caller gets that and a reason rather than a failure.
const explainedGraphAt = async ({ owner, repo, sha }) => {
    const key = `explained:${owner}/${repo}@${sha}`;
    const cached = graphCache.get(key);
    if (cached) return { graph: cached, explained: true };

    const graph = await graphAt({ owner, repo, sha });
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { graph, explained: false, notice: "The assistant isn't set up here, so boxes use folder names." };

    try {
        return { graph: remember(key, await explainGraph({ apiKey, graph })), explained: true };
    } catch (error) {
        logger.warn({ err: error, owner, repo, providerCode: error.providerCode }, "couldn't name the modules of a repository");
        return { graph, explained: false, notice: "The assistant couldn't name the modules just now, so boxes use folder names." };
    }
};

const respondToFailure = (res, error, context) => {
    if (error instanceof RepositoryError) return res.status(error.status).json({ message: error.message });
    logger.error({ err: error, ...context }, "architecture request failed");
    return res.status(500).json({ message: "Couldn't map that repository. Try again in a moment." });
};

const importRepository = async (req, res) => {
    try {
        const parsed = parseRepositoryUrl(req.body.url);
        const { ref, sha } = await resolveCommit(parsed);
        const { owner, repo } = parsed;
        const { graph, explained, notice } = await explainedGraphAt({ owner, repo, sha });
        if (graph.nodes.length === 0) {
            return res.status(422).json({ message: "No source code found there to map." });
        }

        const repoLink = { owner, repo, ref, sha, linkedAt: new Date().toISOString() };
        await Drawing.writeFields(req.drawing._id, { repoLink });
        return res.status(200).json({ repoLink, graph, explained, notice });
    } catch (error) {
        return respondToFailure(res, error, { shareId: req.params.shareId });
    }
};

const getRepositoryLink = (req, res) => res.status(200).json({ repoLink: req.drawing.repoLink ?? null });

const syncRepository = async (req, res) => {
    const { repoLink } = req.drawing;
    if (!repoLink) return res.status(404).json({ message: "This board isn't linked to a repository yet." });
    try {
        const { sha } = await resolveCommit({ owner: repoLink.owner, repo: repoLink.repo, ref: repoLink.ref });
        const { graph, explained, notice } = await explainedGraphAt({ owner: repoLink.owner, repo: repoLink.repo, sha });
        const updatedLink = { ...repoLink, sha, linkedAt: new Date().toISOString() };
        await Drawing.writeFields(req.drawing._id, { repoLink: updatedLink });
        return res.status(200).json({ repoLink: updatedLink, graph, explained, notice, unchanged: sha === repoLink.sha });
    } catch (error) {
        return respondToFailure(res, error, { shareId: req.params.shareId });
    }
};

// "12", "#12" or a pull request link means that pull request. Anything else is a
// branch, compared against the commit this board is linked to. No model involved.
const resolveComparison = async (repoLink, target) => {
    const text = String(target ?? "").trim();
    const pull = text.match(/^#?(\d+)$/)?.[1] ?? text.match(/\/pull\/(\d+)/)?.[1];
    if (pull) {
        const details = await resolvePullRequest({ owner: repoLink.owner, repo: repoLink.repo, pull });
        return { baseSha: details.baseSha, headSha: details.headSha, label: `#${details.number} ${details.title}` };
    }
    const { sha } = await resolveCommit({ owner: repoLink.owner, repo: repoLink.repo, ref: text });
    return { baseSha: repoLink.sha, headSha: sha, label: text };
};

const compareRepository = async (req, res) => {
    const { repoLink } = req.drawing;
    if (!repoLink) return res.status(404).json({ message: "This board isn't linked to a repository yet." });
    const { owner, repo } = repoLink;
    try {
        const { baseSha, headSha, label } = await resolveComparison(repoLink, req.body.target);
        // The same boxes on both sides, or a folder merely opening up would read as a change.
        const { folders } = await graphAt({ owner, repo, sha: repoLink.sha });
        const head = await buildModuleGraphIsolated(await readRepositoryFiles({ owner, repo, sha: headSha }), { folders });
        const base = await buildModuleGraphIsolated(await readRepositoryFiles({ owner, repo, sha: baseSha }), { folders });
        return res.status(200).json({ label, baseSha, headSha, diff: diffModuleGraphs(base, head) });
    } catch (error) {
        return respondToFailure(res, error, { shareId: req.params.shareId });
    }
};

export { importRepository, getRepositoryLink, syncRepository, compareRepository };
