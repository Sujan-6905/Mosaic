"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import {
    faUsers,
    faZap,
    faShield,
    faCheck,
    faStar,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSession } from "next-auth/react"; // Import useSession

import Menu from "@/components/Menu";
import Toolbox from "@/components/Toolbox";
import Whiteboard from "@/components/Whiteboard";
import Toast, { useToast } from "@/components/Toast";
import HomePage from "@/components/HomePage"; // Import the new HomePage component

import { changeColor, changeBrushSize } from "@/slice/toolboxSlice";
import { menuItemClick, actionItemClick } from "@/slice/menuSlice";
import { COLORS } from "@/constants";
import styles from "./index.module.css";

export default function Home({ onAuthClick }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const canvasRef = useRef(null);
    const { data: session, status } = useSession(); // Use the useSession hook
    const isAuthenticated = status === "authenticated";

    const { toasts, removeToast, showToast } = useToast();

    // Redux state
    const { activeMenuItem } = useSelector((state) => state.menu);
    // Safely access color and size with fallbacks
    const toolboxState = useSelector((state) => state.toolbox[activeMenuItem]);
    const color = toolboxState?.color || COLORS.BLACK;
    const size = toolboxState?.size || 3;

    // Local state for UI
    const [opacity, setOpacity] = useState(100);

    // Handle drawing ID from URL query
    useEffect(() => {
        if (router.query.shareId && isAuthenticated) {
            // Load specific drawing - logic handled in Whiteboard component via shareId prop
            console.log("Loading drawing:", router.query.shareId);
        }
    }, [router.query.shareId, isAuthenticated]);

    // Handle menu item clicks
    const handleMenuItemClick = (item) => {
        console.log("menu Item Clicked", item);
        dispatch(menuItemClick(item));
    };

    const handleActionItemClick = (item) => {
        dispatch(actionItemClick(item));
    };

    // Handle toolbox changes
    const handleColorChange = (newColor) => {
        dispatch(changeColor({ item: activeMenuItem, color: newColor }));
    };

    const handleBrushSizeChange = (newSize) => {
        dispatch(changeBrushSize({ item: activeMenuItem, size: newSize }));
    };

    const handleOpacityChange = (newOpacity) => {
        setOpacity(newOpacity);
    };

    // Use useCallback to ensure this function reference is stable
    const handleCanvasReady = useCallback((canvas) => {
        console.log("Canvas ready:", canvas);
    }, []);

    const handleGetStarted = () => {
        onAuthClick && onAuthClick("register");
    };

    // Show loading state while session is being fetched
    if (status === "loading") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    flexDirection: "column",
                    gap: "1rem",
                }}
            >
                <div
                    style={{
                        width: "40px",
                        height: "40px",
                        border: "3px solid #f1f5f9",
                        borderTop: "3px solid #6366f1",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginBottom: "1rem",
                    }}
                ></div>
                <p style={{ color: "#64748b" }}>Loading...</p>
            </div>
        );
    }

    // Conditional rendering based on authentication and shareId
    if (!isAuthenticated) {
        return (
            // This is your existing landing page for unauthenticated users
            <div className={/* Removed styles.landingPage, it's not needed here anymore */ null}>
                {/* Hero Section */}
                <section className={styles.heroSection}>
                    <div className={styles.heroContent}>
                        <div className={styles.heroBadge}>
                            <FontAwesomeIcon icon={faStar} className={styles.badgeIcon} />
                            <span>Trusted by creative teams</span>
                        </div>
                        <h1 className={styles.heroTitle}>
                            Your Ideas Deserve a
                            <span className={styles.heroTitleGradient}>Better Canvas</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            A simple, powerful whiteboard that helps teams brainstorm, plan,
                            and create together.
                        </p>
                        <div className={styles.heroButtons}>
                            <button
                                className={styles.primaryButton}
                                onClick={handleGetStarted}
                            >
                                <FontAwesomeIcon icon={faPlus} className={styles.buttonIcon} />
                                Start Creating Free
                            </button>
                        </div>
                        <div className={styles.heroStats}>
                            <div className={styles.statItem}>
                                <div className={styles.statNumber}>Simple</div>
                                <div className={styles.statLabel}>Easy to Use</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statNumber}>Fast</div>
                                <div className={styles.statLabel}>Lightning Speed</div>
                            </div>
                            <div className={styles.statItem}>
                                <div className={styles.statNumber}>Secure</div>
                                <div className={styles.statLabel}>Your Data Safe</div>
                            </div>
                        </div>
                    </div>
                    {/* Floating Elements */}
                    <div className={styles.floatingElement + " " + styles.float1}></div>
                    <div className={styles.floatingElement + " " + styles.float2}></div>
                    <div className={styles.floatingElement + " " + styles.float3}></div>
                </section>

                {/* Features Section */}
                <section className={styles.featuresSection}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            Everything you need to create
                        </h2>
                        <p className={styles.sectionSubtitle}>
                            Powerful tools designed for teams who want to focus on ideas, not
                            complexity
                        </p>
                    </div>
                    <div className={styles.featuresGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>
                                <FontAwesomeIcon icon={faUsers} />
                            </div>
                            <h3 className={styles.featureTitle}>Team Collaboration</h3>
                            <p className={styles.featureDescription}>
                                Work together seamlessly with your team. Share ideas and create
                                together in real-time.
                            </p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>
                                <FontAwesomeIcon icon={faZap} />
                            </div>
                            <h3 className={styles.featureTitle}>Lightning Fast</h3>
                            <p className={styles.featureDescription}>
                                No waiting, no lag. Start drawing immediately and see your ideas
                                come to life instantly.
                            </p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureIcon}>
                                <FontAwesomeIcon icon={faShield} />
                            </div>
                            <h3 className={styles.featureTitle}>Secure & Private</h3>
                            <p className={styles.featureDescription}>
                                Your work stays private. Enterprise-grade security ensures your
                                ideas are protected.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className={styles.ctaSection}>
                    <div className={styles.ctaContent}>
                        <h2 className={styles.ctaTitle}>Ready to start creating?</h2>
                        <p className={styles.ctaSubtitle}>
                            Join teams who trust our platform for their most important work
                        </p>
                        <div className={styles.ctaButtons}>
                            <button className={styles.ctaButton} onClick={handleGetStarted}>
                                <FontAwesomeIcon icon={faPlus} className={styles.buttonIcon} />
                                Get Started Free
                            </button>
                        </div>
                        <div className={styles.ctaFeatures}>
                            <div className={styles.ctaFeature}>
                                <FontAwesomeIcon icon={faCheck} />
                                <span>Free to start</span>
                            </div>
                            <div className={styles.ctaFeature}>
                                <FontAwesomeIcon icon={faCheck} />
                                <span>No setup required</span>
                            </div>
                            <div className={styles.ctaFeature}>
                                <FontAwesomeIcon icon={faCheck} />
                                <span>Works everywhere</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className={styles.footer}>
                    <div className={styles.footerContent}>
                        <div className={styles.footerLogo}>
                            <div className={styles.logoIcon}></div>
                            <span className={styles.logoText}>Whiteboard</span>
                        </div>
                        <p className={styles.footerText}>
                            © 2024 Whiteboard. Built for creative teams everywhere.
                        </p>
                    </div>
                </footer>

                {/* Toast Notifications */}
                <Toast toasts={toasts} removeToast={removeToast} />
            </div>
        );
    }

    // Authenticated user logic
    if (isAuthenticated && router.query.shareId) {
        return (
            <>
                {/* Whiteboard - Full Screen */}
                <Whiteboard
                    canvasRef={canvasRef}
                    onCanvasReady={handleCanvasReady}
                    showToast={showToast}
                    shareId={router.query.shareId}
                />

                {/* Menu - Overlay */}
                <Menu
                    activeMenuItem={activeMenuItem}
                    onMenuItemClick={handleMenuItemClick}
                    onActionItemClick={handleActionItemClick}
                    showToast={showToast}
                />

                {/* Toolbox - Overlay */}
                <Toolbox
                    activeMenuItem={activeMenuItem}
                    selectedColor={color}
                    selectedBrushSize={size}
                    opacity={opacity}
                    onColorChange={handleColorChange}
                    onBrushSizeChange={handleBrushSizeChange}
                    onOpacityChange={handleOpacityChange}
                />

                {/* Toast Notifications */}
                <Toast toasts={toasts} removeToast={removeToast} />
            </>
        );
    } else if (isAuthenticated && !router.query.shareId) {
        // Show the HomePage component when authenticated and no shareId
        return <HomePage />;
    }

    // This part should ideally not be reached if the isAuthenticated check is comprehensive,
    // but added for completeness or if other states exist.
    return null;
}
