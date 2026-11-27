import { Html, Head, Main, NextScript } from "next/document";

// Sets data-theme before first paint so nothing flashes while React hydrates: a stored choice wins, otherwise light;
// ThemeProvider applies a signed-in user's saved preference afterwards.
const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("mosaic:theme");
    document.documentElement.setAttribute("data-theme", stored === "dark" ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />

                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="manifest" href="/manifest.webmanifest" />
                <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
                <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <meta name="theme-color" content="#08080a" />

                {/* Linked here rather than @imported from globals.css, which would wait for that stylesheet first and
            serialise two round trips for what first paint depends on most. */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="preconnect" href="https://api.fontshare.com" />
                <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Azeret+Mono:wght@300;400;500&display=swap"
                />
                <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=zodiak@300,400,401,700,800&display=swap" />
            </Head>
            <body className="antialiased">
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
