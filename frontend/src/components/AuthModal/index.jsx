"use client"

import { useState } from "react"
import { signIn } from "next-auth/react" // Import NextAuth's signIn function
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTimes, faEye, faEyeSlash, faUser, faEnvelope, faLock, faArrowLeft } from "@fortawesome/free-solid-svg-icons"
import { faGithub, faGoogle } from "@fortawesome/free-brands-svg-icons" // Import social icons
import styles from "./index.module.css"
import cx from "classnames"

const AuthModal = ({ isOpen, onClose, mode = "login", onSwitchMode, onSubmit, loading = false }) => {
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
        signIn(provider)
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
            handleBackToLogin()
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
                        {/* Social Auth */}
                        <div className={styles.socialAuth}>
                            <button
                                type="button"
                                className={cx(styles.socialButton, styles.googleButton)}
                                onClick={() => handleSocialAuth("google")}
                                disabled={loading}
                            >
                                <FontAwesomeIcon icon={faGoogle} className={styles.socialIcon} />
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