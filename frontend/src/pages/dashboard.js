"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Dashboard from "@/components/Dashboard";

const DashboardPage = ({ showToast }) => {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [isLoading, setIsLoading] = useState(true);

    // Check for authentication on mount
    useEffect(() => {
        // If the session status is loading, we show the loading state
        if (status === "loading") {
            setIsLoading(true);
            return;
        }

        // If the status is not authenticated, redirect the user
        if (status === "unauthenticated") {
            showToast?.error(
                "Access Denied",
                "Kindly login first to access the dashboard.",
            );
            router.push("/");
        }

        // If the status is authenticated, we can stop the loading state
        if (status === "authenticated") {
            setIsLoading(false);
        }
    }, [status, router, showToast]);

    if (isLoading || status === "loading") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    flexDirection: "column",
                    gap: "1rem",
                }}
            >
                <div
                    style={{
                        width: "40px",
                        height: "40px",
                        border: "3px solid #f1f5f9",
                        borderTop: "3px solid #6366f1",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                    }}
                ></div>
                <p style={{ color: "#64748b" }}>Loading dashboard...</p>
            </div>
        );
    }

    // Pass session data and status to the Dashboard component
    return <Dashboard showToast={showToast} />;
};

export default DashboardPage;
