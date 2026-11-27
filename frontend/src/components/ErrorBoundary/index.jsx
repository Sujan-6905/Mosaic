import { Component } from "react";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Button from "@/components/ui/Button";
import { reportClientError } from "@/lib/reportClientError";
import styles from "./index.module.css";

// A class component: getDerivedStateFromError and componentDidCatch have no hook equivalent.
// _app wraps page content and chrome in separate boundaries, so a crash in one leaves the other up.
class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        reportClientError({ message: error.message, stack: error.stack, componentStack: info.componentStack });
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className={styles.fallback} role="alert">
                <FontAwesomeIcon icon={faTriangleExclamation} className={styles.icon} />
                <p className={styles.title}>{this.props.label ?? "Something went wrong here."}</p>
                <p className={styles.detail}>The error has been reported. Try again, or reload the page if it keeps happening.</p>
                <div className={styles.actions}>
                    <Button variant="secondary" onClick={this.handleReset}>
                        Try again
                    </Button>
                    <Button variant="primary" onClick={() => window.location.reload()}>
                        Reload page
                    </Button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
