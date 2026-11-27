import Head from "next/head";
import EmbedView from "@/features/embed/EmbedView";
import { SITE_URL } from "@/features/site/seo/siteMetadata";

const SHARE_ID = /^[A-Za-z0-9_-]{1,40}$/;

// Which sites may frame this page is the board owner's call, decided per request before anything is sent;
// a board with embedding off can only be framed by Mosaic itself.
export async function getServerSideProps({ params, query, res }) {
    const shareId = SHARE_ID.test(params.shareId) ? params.shareId : null;
    const response = shareId ? await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/embed/${shareId}/policy`).catch(() => null) : null;
    const policy = response?.ok ? await response.json() : { exists: false, enabled: false, sites: [] };
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self'${policy.enabled ? policy.sites.map((site) => ` ${site}`).join("") : ""}`);
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const pick = (value) => (typeof value === "string" && value.length <= 80 ? value : null);
    return {
        props: {
            shareId: shareId ?? params.shareId.slice(0, 40),
            frameId: pick(query.frame),
            version: /^\d{1,9}$/.test(query.version ?? "") ? query.version : null,
            showComments: query.comments !== "off",
            sites: policy.enabled ? policy.sites : [],
            title: policy.title ?? null,
            isPublic: Boolean(policy.public),
        },
    };
}

export default function EmbedPage({ shareId, frameId, version, showComments, sites, title, isPublic }) {
    const pageUrl = `${SITE_URL}/embed/${encodeURIComponent(shareId)}`;
    return (
        <>
            <Head>
                <title>{title ? `${title} · Mosaic` : "Mosaic board"}</title>
                <meta name="robots" content={isPublic ? "index" : "noindex"} />
                {isPublic && (
                    <>
                        <meta property="og:title" content={title || "Mosaic board"} />
                        <meta property="og:site_name" content="Mosaic" />
                        <meta property="og:type" content="website" />
                        <meta property="og:url" content={pageUrl} />
                        <meta property="og:image" content={`${SITE_URL}/api/embed/${encodeURIComponent(shareId)}/snapshot.png`} />
                        <meta name="twitter:card" content="summary_large_image" />
                        <link
                            rel="alternate"
                            type="application/json+oembed"
                            href={`${SITE_URL}/oembed?url=${encodeURIComponent(pageUrl)}`}
                            title={title || "Mosaic board"}
                        />
                    </>
                )}
            </Head>
            <main id="main">
                <EmbedView shareId={shareId} frameId={frameId} version={version} sites={sites} showComments={showComments} />
            </main>
        </>
    );
}
