import styles from "./CommentMark.module.css";

// The speech bubble every comment wears, drawn so its tail tip is the box's
// bottom-left corner: position that corner on the spot and the point is exact.
const CommentMark = ({ children }) => (
    <span className={styles.mark}>
        <svg className={styles.bubble} viewBox="0 0 34 34" aria-hidden="true">
            <path d="M19 2.5a13.5 13.5 0 1 1-6.7 25.2L3.4 31a.5.5 0 0 1-.65-.65l3.3-8.9A13.5 13.5 0 0 1 19 2.5Z" />
        </svg>
        <span className={styles.face}>{children}</span>
    </span>
);

export default CommentMark;
