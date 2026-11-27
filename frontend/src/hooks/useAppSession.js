import { useSession } from "next-auth/react";

// A first-time OAuth login holds a next-auth session before a username is
// picked, with no backend token yet; only the token means signed in.
export default function useAppSession() {
    const { data: session, status } = useSession();
    return { session, status, isAuthenticated: !!session?.accessToken };
}
