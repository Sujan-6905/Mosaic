import { llmsTxt, sendTextFile } from "@/features/site/seo/discoveryFiles";

export const getServerSideProps = ({ res }) => sendTextFile(res, "text/markdown", llmsTxt());

export default function LlmsTxt() {
    return null;
}
