// components/HomePage.js
import React from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faDrawPolygon,
    faFolderOpen,
    faPlusCircle,
    faUserCircle,
    faShareAlt,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./index.module.css"; // Ensure this path is correct

const HomePage = () => {
    return (
        <div className={styles.homePageContainer}>
            <section className={styles.heroSection}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Welcome to Your <span className={styles.heroTitleGradient}>Collaborative Whiteboard!</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Unleash your creativity and collaborate in real-time.
                    </p>
                    <div className={styles.heroButtons}>
                        <Link href="/dashboard" className={styles.primaryButton}>
                            <FontAwesomeIcon icon={faPlusCircle} className={styles.buttonIcon} />
                            Create New Drawing
                        </Link>
                    </div>
                </div>
            </section>

            <section className={styles.infoSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Getting Started</h2>
                    <p className={styles.sectionSubtitle}>
                        Here's how to navigate and make the most of your whiteboard experience.
                    </p>
                </div>
                <div className={styles.infoGrid}>
                    <div className={styles.infoCard}>
                        <div className={styles.infoIcon}>
                            <FontAwesomeIcon icon={faUserCircle} />
                        </div>
                        <h3 className={styles.infoTitle}>Your Profile & Drawings</h3>
                        <p className={styles.infoDescription}>
                            Access your profile settings and manage all your drawings (owned and shared) by clicking your profile icon in the top right corner.
                        </p>
                        <div className={styles.exampleText}>
                            Look for: <FontAwesomeIcon icon={faUserCircle} /> (Top Right)
                        </div>
                    </div>

                    <div className={styles.infoCard}>
                        <div className={styles.infoIcon}>
                            <FontAwesomeIcon icon={faFolderOpen} />
                        </div>
                        <h3 className={styles.infoTitle}>View & Edit Drawings</h3>
                        <p className={styles.infoDescription}>
                            From your profile menu, select "View Drawings" to see a list of all whiteboards you can access. Click on any drawing to open and edit it.
                        </p>
                        <div className={styles.exampleText}>
                            Navigation: Profile &gt; View Drawings
                        </div>
                    </div>

                    <div className={styles.infoCard}>
                        <div className={styles.infoIcon}>
                            <FontAwesomeIcon icon={faDrawPolygon} />
                        </div>
                        <h3 className={styles.infoTitle}>Create New Drawings</h3>
                        <p className={styles.infoDescription}>
                            To start fresh, simply click the "Create New Drawing" button above or navigate to the new drawing page. Your blank canvas awaits!
                        </p>
                        <div className={styles.exampleText}>
                            Action: <FontAwesomeIcon icon={faPlusCircle} /> Create New Drawing
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.ctaSection}>
                <div className={styles.ctaContent}>
                    <h2 className={styles.ctaTitle}>Ready to brainstorm your next big idea?</h2>
                    <Link href="/dashboard" className={styles.ctaButton}>
                        <FontAwesomeIcon icon={faPlusCircle} className={styles.buttonIcon} />
                        Start Drawing Now
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
