import Head from "next/head";
import { SITE_DESCRIPTION, SITE_NAME, SOCIAL_IMAGE, absoluteUrl } from "./siteMetadata";

// Private and per-person pages pass noindex and no path, so they never claim a canonical URL.
export default function PageSeo({ title, description = SITE_DESCRIPTION, path, noindex = false, structuredData = [] }) {
    const canonical = path ? absoluteUrl(path) : null;
    const image = absoluteUrl(SOCIAL_IMAGE.path);

    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />
            {canonical && <link rel="canonical" href={canonical} />}

            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            {canonical && <meta property="og:url" content={canonical} />}
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content={String(SOCIAL_IMAGE.width)} />
            <meta property="og:image:height" content={String(SOCIAL_IMAGE.height)} />
            <meta property="og:image:alt" content={SOCIAL_IMAGE.alt} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {structuredData.map((data, index) => (
                <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
            ))}
        </Head>
    );
}
