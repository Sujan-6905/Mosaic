// schema.org JSON-LD, which search engines and AI answer engines read to know what the product is.
import { SOURCE_URL } from "../siteContent";
import { FEATURES, SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE, absoluteUrl } from "./siteMetadata";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const organization = {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon-512.png"),
    sameAs: [SOURCE_URL],
};

const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": ORGANIZATION_ID },
};

const application = {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "DesignApplication",
    applicationSubCategory: "Online collaborative whiteboard",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and a modern browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: FEATURES,
    screenshot: absoluteUrl(SOCIAL_IMAGE.path),
    publisher: { "@id": ORGANIZATION_ID },
};

const graph = (...nodes) => ({ "@context": "https://schema.org", "@graph": nodes });

export const homeStructuredData = () => graph(organization, website, application);

export const breadcrumbStructuredData = (path, title) =>
    graph({
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
            { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(path) },
        ],
    });

// Each guide becomes a HowTo, so its steps can surface as an answer on their own.
export const guidesStructuredData = (guides) =>
    graph(
        ...guides.map((guide) => ({
            "@type": "HowTo",
            name: `${guide.label} in Mosaic`,
            url: absoluteUrl(`/help#${guide.id}`),
            step: guide.steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.title, text: step.body })),
        })),
    );
