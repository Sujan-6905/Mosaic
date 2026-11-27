import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import Radio from "@/components/ui/Radio";
import BoardPicker from "@/components/BoardPicker";
import styles from "./authorize.module.css";

const ACCESS_CHOICES = [
    { value: "write", label: "Read and edit", detail: "Draw, edit and comment on boards you can edit." },
    { value: "read", label: "Read only", detail: "Look at boards, never change them." },
];

const denyUrl = (redirectUri, state) => {
    const target = new URL(redirectUri);
    target.searchParams.set("error", "access_denied");
    if (state) target.searchParams.set("state", state);
    return target.toString();
};

// Where an agent app sends a person to let it use Mosaic for them. Nothing is
// granted until they choose what it may do and press Allow.
export default function Authorize({ isAuthenticated, user, onAuthClick }) {
    const router = useRouter();
    const { data: session } = useSession();
    const query = router.query;
    const [client, setClient] = useState(null);
    const [problem, setProblem] = useState(null);
    const [scope, setScope] = useState("write");
    const [limitBoards, setLimitBoards] = useState(false);
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!router.isReady) return;
        if (query.response_type !== "code" || query.code_challenge_method !== "S256" || !query.code_challenge) {
            setProblem("This app asked to connect in a way Mosaic doesn't support (it must use PKCE with S256).");
            return;
        }
        if (query.scope === "read") setScope("read");
        axiosInstance
            .get("/api/oauth/client", { params: { client_id: query.client_id, redirect_uri: query.redirect_uri } })
            .then(({ data }) => setClient(data))
            .catch((error) => setProblem(error.response?.data?.message ?? "Couldn't check this app."));
    }, [router.isReady, query.response_type, query.code_challenge_method, query.code_challenge, query.client_id, query.redirect_uri, query.scope]);

    const allow = async () => {
        setBusy(true);
        try {
            const { data } = await axiosInstance.post(
                "/api/oauth/authorize",
                {
                    client_id: query.client_id,
                    redirect_uri: query.redirect_uri,
                    code_challenge: query.code_challenge,
                    code_challenge_method: "S256",
                    state: query.state,
                    resource: query.resource,
                    scope,
                    boards: limitBoards ? chosen : undefined,
                },
                { headers: { Authorization: `Bearer ${session.accessToken}` } },
            );
            window.location.assign(data.redirect);
        } catch (error) {
            setProblem(error.response?.data?.message ?? "Couldn't connect the app. Try again.");
            setBusy(false);
        }
    };

    return (
        <main id="main" className={styles.page}>
            <Head>
                <title>Connect an app · Mosaic</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <section className={styles.card} aria-labelledby="authorizeTitle">
                <p className={styles.eyebrow}>Mosaic</p>
                {problem ? (
                    <>
                        <h1 id="authorizeTitle" className={styles.title}>
                            Can&apos;t connect this app
                        </h1>
                        <p className={styles.lead}>{problem}</p>
                    </>
                ) : !client ? (
                    <h1 id="authorizeTitle" className={styles.title}>
                        Checking the app
                    </h1>
                ) : !isAuthenticated ? (
                    <>
                        <h1 id="authorizeTitle" className={styles.title}>
                            Sign in to connect {client.clientName}
                        </h1>
                        <p className={styles.lead}>{client.clientName} wants to use your Mosaic boards. Sign in first, then choose what it may do.</p>
                        <button type="button" className={styles.primary} onClick={() => onAuthClick("login")}>
                            Sign in
                        </button>
                    </>
                ) : (
                    <>
                        <h1 id="authorizeTitle" className={styles.title}>
                            Let {client.clientName} use Mosaic as {user?.username ?? "you"}?
                        </h1>
                        <p className={styles.lead}>
                            It will act on boards for you and appear on them as &ldquo;{client.clientName} for {user?.username ?? "you"}&rdquo;. After you allow
                            it, you return to <strong>{client.redirectHost}</strong>.
                        </p>
                        <fieldset className={styles.group}>
                            <legend>What it may do</legend>
                            {ACCESS_CHOICES.map((choice) => (
                                <label key={choice.value} className={styles.choice}>
                                    <Radio name="scope" value={choice.value} checked={scope === choice.value} onChange={() => setScope(choice.value)} />
                                    <span>
                                        <strong>{choice.label}</strong>
                                        {choice.detail}
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        <fieldset className={styles.group}>
                            <legend>Which boards</legend>
                            <label className={styles.choice}>
                                <Radio name="boards" checked={!limitBoards} onChange={() => setLimitBoards(false)} />
                                <span>
                                    <strong>All boards I can open</strong>Including ones shared with me later.
                                </span>
                            </label>
                            <label className={styles.choice}>
                                <Radio name="boards" checked={limitBoards} onChange={() => setLimitBoards(true)} />
                                <span>
                                    <strong>Only boards I pick</strong>It can&apos;t see any other.
                                </span>
                            </label>
                            {limitBoards && <BoardPicker token={session?.accessToken} chosen={chosen} onChange={setChosen} />}
                        </fieldset>
                        <p className={styles.fine}>Board owners can still limit what agents do on their boards. Disconnect it any time in Profile.</p>
                        <div className={styles.actions}>
                            <button type="button" className={styles.ghost} onClick={() => window.location.assign(denyUrl(query.redirect_uri, query.state))}>
                                Deny
                            </button>
                            <button type="button" className={styles.primary} disabled={busy || (limitBoards && chosen.length === 0)} onClick={allow}>
                                {busy ? "Connecting" : "Allow"}
                            </button>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}
