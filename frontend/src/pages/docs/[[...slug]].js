import DocsPage from "@/features/docs/DocsPage";
import { DOC_PAGES } from "@/features/docs/docsNavigation";

export const getStaticPaths = () => ({
    paths: DOC_PAGES.map((page) => ({ params: { slug: page.slug ? [page.slug] : [] } })),
    fallback: false,
});

export const getStaticProps = ({ params }) => ({ props: { slug: params.slug?.[0] ?? "" } });

export default function Docs({ slug, onAuthClick }) {
    return <DocsPage key={slug} slug={slug} onAuthClick={onAuthClick} />;
}
