import HowItWorks from "@/features/site/howItWorks/HowItWorks";

export default function AboutPage({ isAuthenticated, onAuthClick }) {
    return <HowItWorks isAuthenticated={isAuthenticated} onSignIn={() => onAuthClick?.("login")} onGetStarted={() => onAuthClick?.("register")} />;
}
