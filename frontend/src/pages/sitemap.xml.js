import { sitemapXml, sendTextFile } from "@/features/site/seo/discoveryFiles";

export const getServerSideProps = ({ res }) => sendTextFile(res, "application/xml", sitemapXml());

export default function SitemapXml() {
    return null;
}
