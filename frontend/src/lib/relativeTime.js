// "Just now", "3 min ago", "Yesterday", then a short date.
export function relativeTime(value) {
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "Last week";
    return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
