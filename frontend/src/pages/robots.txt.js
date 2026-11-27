import { robotsTxt, sendTextFile } from "@/features/site/seo/discoveryFiles";

export const getServerSideProps = ({ res }) => sendTextFile(res, "text/plain", robotsTxt());

export default function RobotsTxt() {
    return null;
}
