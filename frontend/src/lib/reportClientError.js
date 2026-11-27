import { getCorrelationId } from "./correlationId";

const endpoint = () => `${process.env.NEXT_PUBLIC_API_URL}/api/client-errors`;

// Fetch with keepalive survives the unload that often follows a crash; sendBeacon always sends credentials,
// which this cross-origin endpoint's CORS policy refuses.
export const reportClientError = ({ message, stack, componentStack, url }) => {
    if (typeof window === "undefined") return;

    const payload = JSON.stringify({
        message: String(message ?? "Unknown client error").slice(0, 2000),
        stack: stack ? String(stack).slice(0, 8000) : undefined,
        componentStack: componentStack ? String(componentStack).slice(0, 8000) : undefined,
        url: url || window.location.href,
        correlationId: getCorrelationId(),
    });

    fetch(endpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
    }).catch(() => {
        // Reporting the failure to report an error would be its own
        // infinite regress: nothing further to do here.
    });
};

// Catches what an ErrorBoundary can't: errors outside render (handlers, timers, non-React code) and unhandled rejections.
export const installGlobalErrorReporting = () => {
    if (typeof window === "undefined") return;

    window.addEventListener("error", (event) => {
        reportClientError({ message: event.message, stack: event.error?.stack });
    });

    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        reportClientError({
            message: reason instanceof Error ? reason.message : `Unhandled rejection: ${String(reason)}`,
            stack: reason instanceof Error ? reason.stack : undefined,
        });
    });
};
