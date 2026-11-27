export const downloadUrl = (href, filename) => Object.assign(document.createElement("a"), { href, download: filename }).click();

// The object URL outlives the click briefly, since some browsers start the download after it returns.
export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
