"use client"

import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes, faEye, faEyeSlash, faUser, faEnvelope, faLock, faArrowLeft } from "@fortawesome/free-solid-svg-icons"
import { faGithub } from "@fortawesome/free-brands-svg-icons"
import styles from "./index.module.css"
import cx from "classnames"

const AuthModal = ({ isOpen, onClose, mode = "login", onSwitchMode, onSubmit, onSocialAuth, loading = false }) => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [errors, setErrors] = useState({})
    const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
    const [otpMode, setOtpMode] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    const [otp, setOtp] = useState("")
    const [otpLoading, setOtpLoading] = useState(false)

    const isLogin = mode === "login"
    const isRegister = mode === "register"

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.email) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Email is invalid"
        }

        if (!formData.password) {
            newErrors.password = "Password is required"
        } else if (formData.password.length < 6) {
            newErrors.password = "Password must be at least 6 characters"
        }

        if (isRegister) {
            if (!formData.name) {
                newErrors.name = "Name is required"
            }
            if (!formData.confirmPassword) {
                newErrors.confirmPassword = "Please confirm your password"
            } else if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = "Passwords don't match"
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (validateForm()) {
            onSubmit && onSubmit(formData)
        }
    }

    const handleSocialAuth = (provider) => {
        onSocialAuth && onSocialAuth(provider)
    }

    const handleSwitchMode = () => {
        setFormData({
            name: "",
            email: "",
            password: "",
            confirmPassword: "",
        })
        setErrors({})
        setShowPassword(false)
        setShowConfirmPassword(false)
        setForgotPasswordMode(false)
        setOtpMode(false)
        onSwitchMode && onSwitchMode()
    }

    const handleForgotPassword = () => {
        setForgotPasswordMode(true)
        setErrors({})
    }

    const handleBackToLogin = () => {
        setForgotPasswordMode(false)
        setOtpMode(false)
        setForgotEmail("")
        setOtp("")
        setErrors({})
    }

    const handleSendOtp = async (e) => {
        e.preventDefault()
        if (!forgotEmail) {
            setErrors({ email: "Email is required" })
            return
        }
        if (!/\S+@\S+\.\S+/.test(forgotEmail)) {
            setErrors({ email: "Email is invalid" })
            return
        }

        setOtpLoading(true)
        try {
            // Mock API call - replace with actual endpoint
            await new Promise((resolve) => setTimeout(resolve, 1500))
            setOtpMode(true)
            setErrors({})
            // Show success message via toast would be better
        } catch (error) {
            setErrors({ email: "Failed to send OTP. Please try again." })
        } finally {
            setOtpLoading(false)
        }
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        if (!otp || otp.length !== 6) {
            setErrors({ otp: "Please enter a valid 6-digit OTP" })
            return
        }

        setOtpLoading(true)
        try {
            // Mock API call - replace with actual endpoint
            await new Promise((resolve) => setTimeout(resolve, 1500))
            // Handle successful OTP verification
            handleBackToLogin()
            // Show success message
        } catch (error) {
            setErrors({ otp: "Invalid OTP. Please try again." })
        } finally {
            setOtpLoading(false)
        }
    }

    const handleResendOtp = async () => {
        setOtpLoading(true)
        try {
            // Mock API call - replace with actual endpoint
            await new Promise((resolve) => setTimeout(resolve, 1000))
            // Show success message via toast
        } catch (error) {
            setErrors({ otp: "Failed to resend OTP. Please try again." })
        } finally {
            setOtpLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className={styles.closeButton} onClick={onClose}>
                    <FontAwesomeIcon icon={faTimes} />
                </button>

                {/* Back Button for Forgot Password */}
                {(forgotPasswordMode || otpMode) && (
                    <button className={styles.backButton} onClick={handleBackToLogin}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                )}

                {/* Logo */}
                <div className={styles.logo}>
                    <div className={styles.logoIcon}></div>
                    <span className={styles.logoText}>Whiteboard</span>
                </div>

                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {forgotPasswordMode
                            ? otpMode
                                ? "Enter OTP"
                                : "Forgot Password"
                            : isLogin
                                ? "Welcome Back"
                                : "Create Account"}
                    </h2>
                    <p className={styles.subtitle}>
                        {forgotPasswordMode
                            ? otpMode
                                ? `We've sent a 6-digit code to ${forgotEmail}`
                                : "Enter your email to receive a reset code"
                            : isLogin
                                ? "Sign in to continue your creative journey"
                                : "Join thousands of creators on our platform"}
                    </p>
                </div>

                {/* Forgot Password Form */}
                {forgotPasswordMode && !otpMode && (
                    <form className={styles.form} onSubmit={handleSendOtp}>
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <FontAwesomeIcon icon={faEnvelope} className={styles.inputIcon} />
                                <input
                                    type="email"
                                    placeholder="Enter your email address"
                                    value={forgotEmail}
                                    onChange={(e) => {
                                        setForgotEmail(e.target.value)
                                        if (errors.email) setErrors({})
                                    }}
                                    className={cx(styles.input, { [styles.error]: errors.email })}
                                    disabled={otpLoading}
                                />
                            </div>
                            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                        </div>

                        <button
                            type="submit"
                            className={cx(styles.submitButton, { [styles.loading]: otpLoading })}
                            disabled={otpLoading}
                        >
                            {otpLoading ? (
                                <>
                                    <div className={styles.spinner}></div>
                                    Sending OTP...
                                </>
                            ) : (
                                "Send OTP"
                            )}
                        </button>
                    </form>
                )}

                {/* OTP Verification Form */}
                {otpMode && (
                    <form className={styles.form} onSubmit={handleVerifyOtp}>
                        <div className={styles.otpSection}>
                            <div className={styles.emailDisplay}>
                                <span>Sending to: {forgotEmail}</span>
                                <button
                                    type="button"
                                    className={styles.editEmailButton}
                                    onClick={() => setOtpMode(false)}
                                    disabled={otpLoading}
                                >
                                    Edit
                                </button>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <input
                                type="text"
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                                    setOtp(value)
                                    if (errors.otp) setErrors({})
                                }}
                                className={cx(styles.input, styles.otpInput, { [styles.error]: errors.otp })}
                                disabled={otpLoading}
                                maxLength={6}
                            />
                            {errors.otp && <span className={styles.errorText}>{errors.otp}</span>}
                        </div>

                        <div className={styles.otpActions}>
                            <button type="button" className={styles.resendButton} onClick={handleResendOtp} disabled={otpLoading}>
                                Resend OTP
                            </button>
                        </div>

                        <button
                            type="submit"
                            className={cx(styles.submitButton, { [styles.loading]: otpLoading })}
                            disabled={otpLoading}
                        >
                            {otpLoading ? (
                                <>
                                    <div className={styles.spinner}></div>
                                    Verifying...
                                </>
                            ) : (
                                "Verify OTP"
                            )}
                        </button>
                    </form>
                )}

                {/* Regular Auth Forms */}
                {!forgotPasswordMode && (
                    <>
                        {/* Demo Credentials (only for login) */}
                        {isLogin && (
                            <div className={styles.demoCredentials}>
                                <span className={styles.demoTitle}>🔑 Demo: demo@whiteboard.com / demo123</span>
                                <button
                                    type="button"
                                    className={styles.autoFillButton}
                                    onClick={() =>
                                        setFormData({
                                            ...formData,
                                            email: "demo@whiteboard.com",
                                            password: "demo123",
                                        })
                                    }
                                >
                                    Auto-fill
                                </button>
                            </div>
                        )}

                        {/* Social Auth */}
                        <div className={styles.socialAuth}>
                            <button
                                type="button"
                                className={cx(styles.socialButton, styles.googleButton)}
                                onClick={() => handleSocialAuth("google")}
                                disabled={loading}
                            >
                                <svg className={styles.googleIcon} viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Google
                            </button>
                            <button
                                type="button"
                                className={cx(styles.socialButton, styles.githubButton)}
                                onClick={() => handleSocialAuth("github")}
                                disabled={loading}
                            >
                                <FontAwesomeIcon icon={faGithub} className={styles.socialIcon} />
                                GitHub
                            </button>
                        </div>

                        {/* Divider */}
                        <div className={styles.divider}>
                            <span className={styles.dividerText}>Or continue with email</span>
                        </div>

                        {/* Form */}
                        <form className={styles.form} onSubmit={handleSubmit}>
                            {isRegister && (
                                <div className={styles.inputGroup}>
                                    <div className={styles.inputWrapper}>
                                        <FontAwesomeIcon icon={faUser} className={styles.inputIcon} />
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            className={cx(styles.input, { [styles.error]: errors.name })}
                                            placeholder="Full name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                        />
                                    </div>
                                    {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                                </div>
                            )}

                            <div className={styles.inputGroup}>
                                <div className={styles.inputWrapper}>
                                    <FontAwesomeIcon icon={faEnvelope} className={styles.inputIcon} />
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        className={cx(styles.input, { [styles.error]: errors.email })}
                                        placeholder="Email address"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                            </div>

                            <div className={styles.inputGroup}>
                                <div className={styles.inputWrapper}>
                                    <FontAwesomeIcon icon={faLock} className={styles.inputIcon} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        className={cx(styles.input, { [styles.error]: errors.password })}
                                        placeholder="Password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={loading}
                                    >
                                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                                    </button>
                                </div>
                                {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                            </div>

                            {isRegister && (
                                <div className={styles.inputGroup}>
                                    <div className={styles.inputWrapper}>
                                        <FontAwesomeIcon icon={faLock} className={styles.inputIcon} />
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            className={cx(styles.input, { [styles.error]: errors.confirmPassword })}
                                            placeholder="Confirm password"
                                            value={formData.confirmPassword}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            className={styles.passwordToggle}
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            disabled={loading}
                                        >
                                            <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                                        </button>
                                    </div>
                                    {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                                </div>
                            )}

                            {isLogin && (
                                <div className={styles.formOptions}>
                                    <label className={styles.checkboxLabel}>
                                        <input type="checkbox" className={styles.checkbox} />
                                        Remember me
                                    </label>
                                    <button type="button" className={styles.forgotLink} onClick={handleForgotPassword}>
                                        Forgot password?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                className={cx(styles.submitButton, { [styles.loading]: loading })}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className={styles.spinner}></div>
                                        Please wait...
                                    </>
                                ) : isLogin ? (
                                    "Sign In"
                                ) : (
                                    "Create Account"
                                )}
                            </button>
                        </form>

                        {/* Footer */}
                        <div className={styles.footer}>
                            <span className={styles.footerText}>
                                {isLogin ? "Don't have an account?" : "Already have an account?"}
                            </span>
                            <button type="button" className={styles.footerLink} onClick={handleSwitchMode} disabled={loading}>
                                {isLogin ? "Sign up" : "Sign in"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default AuthModal

