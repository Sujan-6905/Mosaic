import { useEffect } from "react";
import { getSession, useSession } from "next-auth/react";
import { dispatchSessionExpired } from "@/lib/axiosInstance";
import { noteAccessToken, setSessionRenewer } from "@/lib/accessToken";

// How often an open tab re-reads its session; next-auth renews the backend
// access token on a read that falls within five minutes of its expiry.
export const SESSION_POLL_SECONDS = 4 * 60;

// Keeps lib/accessToken.js in step with the next-auth session, lets it force a renewal, and turns a sign-in
// the backend has ended into the usual "session expired" sign-out.
export default function useSessionRenewal() {
    const { data: session, update } = useSession();

    useEffect(() => {
        noteAccessToken(session?.accessToken);
    }, [session?.accessToken]);

    useEffect(() => {
        // update() does nothing while a session read is already under way; a plain read then suffices.
        setSessionRenewer(async () => (await update({ renew: true })) ?? getSession());
        return () => setSessionRenewer(null);
    }, [update]);

    useEffect(() => {
        if (session?.error === "SessionEnded") dispatchSessionExpired();
        if (session?.error === "EmailInUse") window.dispatchEvent(new Event("mosaic:email-in-use"));
    }, [session?.error]);
}
