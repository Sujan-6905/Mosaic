import axios from "axios";
import { getCorrelationId } from "./correlationId";
import { tokenAfterRefusal } from "./accessToken";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

const axiosInstance = axios.create({
    baseURL: apiUrl,
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 10000,
});

// Every request carries this tab's correlation id, matched server-side by backend/middlewares/correlationId.js.
axiosInstance.interceptors.request.use((request) => {
    const correlationId = getCorrelationId();
    if (correlationId) {
        request.headers["X-Correlation-Id"] = correlationId;
    }
    return request;
});

// Reached only once token renewal has failed too. Shared by REST 401s and the board socket's "unauthorized"
// error, so a failure on both transports signs out once.
let sessionExpiredDispatched = false;

// One expiry fails every in-flight request with its own 401; Toast's error() checks this flag so only the single
// "session expired" toast shows instead of one per call site.
let errorToastsSuppressed = false;

export const dispatchSessionExpired = () => {
    if (typeof window === "undefined") return;
    errorToastsSuppressed = true;
    if (sessionExpiredDispatched) return;
    sessionExpiredDispatched = true;
    window.dispatchEvent(new Event("mosaic:session-expired"));
};

export const resetSessionExpiredGuard = () => {
    sessionExpiredDispatched = false;
};

export const isErrorToastSuppressed = () => errorToastsSuppressed;

// Called once a fresh, valid session is established (a successful sign-in)
// so a real error after that point isn't silently swallowed too.
export const clearErrorToastSuppression = () => {
    errorToastsSuppressed = false;
};

const bearerOf = (headers) => {
    const value = headers?.Authorization ?? headers?.authorization;
    return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : null;
};

// A 401 on a request that carried a token renews it and retries once. On the server ([...nextauth].js) a 401 is a
// failed login, so this needs a window; _app.js owns the sign-out UI, reached through a DOM event.
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config } = error;
        if (error.response?.status !== 401 || typeof window === "undefined") return Promise.reject(error);
        const sent = bearerOf(config?.headers);
        if (sent && !config.mosaicRetried) {
            const token = await tokenAfterRefusal(sent);
            if (token) {
                config.mosaicRetried = true;
                config.headers.Authorization = `Bearer ${token}`;
                return axiosInstance(config);
            }
        }
        dispatchSessionExpired();
        return Promise.reject(error);
    },
);

export default axiosInstance;
