import { llmsFullTxt, sendTextFile } from "@/features/site/seo/discoveryFiles";

export const getServerSideProps = ({ res }) => sendTextFile(res, "text/markdown", llmsFullTxt());

export default function LlmsFullTxt() {
    return null;
}
