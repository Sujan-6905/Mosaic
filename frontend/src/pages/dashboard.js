import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Dashboard from "@/features/dashboard";

// No loading state here: Dashboard renders its own skeleton while the session resolves, so there is one transition.
const DashboardPage = ({ showToast }) => {
    const router = useRouter();
    const { status } = useSession();

    useEffect(() => {
        if (status === "unauthenticated") router.replace(`/?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }, [status, router]);

    return (
        <>
            <Head>
                <title>All boards · Mosaic</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <Dashboard showToast={showToast} />
        </>
    );
};

export default DashboardPage;
