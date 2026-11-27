// Shows a mention while Mosaic is closed, and opens the board it happened on.

const sameOriginUrl = (path) => {
    try {
        const url = new URL(path || "/", self.location.origin);
        return url.origin === self.location.origin ? url.href : self.location.origin + "/";
    } catch {
        return self.location.origin + "/";
    }
};

self.addEventListener("push", (event) => {
    let message = {};
    try {
        message = event.data ? event.data.json() : {};
    } catch {
        message = { body: event.data ? event.data.text() : "" };
    }
    event.waitUntil(
        self.registration.showNotification(message.title || "Mosaic", {
            body: message.body || "",
            tag: message.tag,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            data: { url: sameOriginUrl(message.url) },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || sameOriginUrl("/");
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
            const open = windows.find((client) => client.url === url);
            return open ? open.focus() : self.clients.openWindow(url);
        }),
    );
});
