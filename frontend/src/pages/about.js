"use client"
import { useRouter } from "next/router"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faUsers,
  faZap,
  faShield,
  faHeart,
  faLightbulb,
  faRocket,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons"
import styles from "./about.module.css"

const AboutPage = () => {
  const router = useRouter()

  const handleBackToHome = () => {
    router.push("/")
  }

  return (
    <div className={styles.aboutPage}>
      {/* Back Button */}
      <button className={styles.backButton} onClick={handleBackToHome}>
        <FontAwesomeIcon icon={faArrowLeft} />
        Back to Home
      </button>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Built for <span className={styles.heroTitleGradient}>Creative Teams</span>
            </h1>
            <p className={styles.heroSubtitle}>
              We believe that great ideas deserve great tools. Our whiteboard platform is designed to help teams
              collaborate, create, and innovate without limits.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className={styles.missionSection}>
        <div className={styles.container}>
          <div className={styles.missionContent}>
            <div className={styles.missionText}>
              <h2 className={styles.sectionTitle}>Our Mission</h2>
              <p className={styles.missionDescription}>
                To democratize creativity by providing simple, powerful tools that help teams bring their ideas to life.
                We're building a platform where distance doesn't matter, complexity doesn't exist, and creativity flows
                freely.
              </p>
              <div className={styles.missionValues}>
                <div className={styles.valueItem}>
                  <FontAwesomeIcon icon={faLightbulb} className={styles.valueIcon} />
                  <div>
                    <h3>Innovation First</h3>
                    <p>We constantly push boundaries to create better experiences</p>
                  </div>
                </div>
                <div className={styles.valueItem}>
                  <FontAwesomeIcon icon={faHeart} className={styles.valueIcon} />
                  <div>
                    <h3>User-Centered</h3>
                    <p>Every feature is designed with our users' needs in mind</p>
                  </div>
                </div>
                <div className={styles.valueItem}>
                  <FontAwesomeIcon icon={faRocket} className={styles.valueIcon} />
                  <div>
                    <h3>Performance</h3>
                    <p>Speed and reliability are at the core of everything we build</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.missionVisual}>
              <div className={styles.visualCard}>
                <div className={styles.visualIcon}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <h3>Team Collaboration</h3>
                <p>Real-time collaboration that feels natural</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Teams Choose Us</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <FontAwesomeIcon icon={faZap} />
              </div>
              <h3>Lightning Fast</h3>
              <p>No waiting, no lag. Start creating immediately with our optimized performance.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <FontAwesomeIcon icon={faShield} />
              </div>
              <h3>Secure & Private</h3>
              <p>Enterprise-grade security ensures your ideas stay protected and private.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <h3>Team-First</h3>
              <p>Built from the ground up for seamless team collaboration.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AboutPage

