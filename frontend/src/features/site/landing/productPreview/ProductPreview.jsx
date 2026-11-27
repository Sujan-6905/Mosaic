import LaunchDock from "./LaunchDock";
import PreviewBoard, { MosaicMark } from "./PreviewBoard";
import styles from "./ProductPreview.module.css";
import { HOSTED_URL } from "../../seo/siteMetadata";

const HOSTED_HOST = new URL(HOSTED_URL).host;

// The editor mid-session as markup rather than a screenshot, so it stays sharp and follows the real tokens.
// The stage stays pinned for the length of the track while productWindowMotion.js opens the window on scroll.
export default function ProductPreview() {
    return (
        <section className={styles.track} aria-label="Product preview" data-preview-track data-nav-section="product">
            <span id="product" className={styles.anchor} aria-hidden="true" />
            <div className={styles.stage}>
                <div className={styles.window} data-window>
                    <div className={styles.browserBar} aria-hidden="true">
                        <span className={styles.browserLights}>
                            <i />
                            <i />
                            <i />
                        </span>
                        <span className={styles.browserTab}>
                            <MosaicMark size="small" />
                            Q4 roadmap
                        </span>
                        <span className={styles.address}>{HOSTED_HOST}</span>
                    </div>
                    <PreviewBoard />
                </div>
                <LaunchDock />
                <p className={styles.caption} data-preview-caption>
                    Q4 roadmap, mid-session: two people, a proposal from the assistant and a comment thread.
                </p>
            </div>
        </section>
    );
}
