import Guides from "@/features/site/guides/Guides";

export default function HelpPage({ isAuthenticated, onAuthClick }) {
    return <Guides isAuthenticated={isAuthenticated} onSignIn={() => onAuthClick?.("login")} onGetStarted={() => onAuthClick?.("register")} />;
}
