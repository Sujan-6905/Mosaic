"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faEye,
    faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { useSession } from "next-auth/react";
import axiosInstance from "@/axiosInstance";
import styles from "./profile.module.css";

const ProfilePage = ({ showToast }) => {
    const router = useRouter();
    const { data: session, status, update } = useSession();

    const isAuthenticated = status === "authenticated";

    const [isLoading, setIsLoading] = useState(true);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [profileData, setProfileData] = useState({
        name: "",
        email: "",
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [errors, setErrors] = useState({});

    // Check for authentication and set initial profile data
    useEffect(() => {
        if (status === "loading") {
            return;
        }

        if (!isAuthenticated) {
            showToast?.error(
                "Access Denied",
                "Kindly login first to access your profile.",
            );
            router.push("/");
        } else {
            setProfileData({
                name: session.user.name,
                email: session.user.email,
            });
        }
        setIsLoading(false);
    }, [isAuthenticated, session, router, showToast, status]);

    const handleProfileInputChange = (e) => {
        const { name, value } = e.target;
        setProfileData((prev) => ({
            ...prev,
            [name]: value,
        }));
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handlePasswordInputChange = (e) => {
        const { name, value } = e.target;
        setPasswordData((prev) => ({
            ...prev,
            [name]: value,
        }));
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const validateProfileForm = () => {
        const newErrors = {};

        if (!profileData.name.trim()) {
            newErrors.name = "Name is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validatePasswordForm = () => {
        const newErrors = {};

        if (!passwordData.currentPassword) {
            newErrors.currentPassword = "Current password is required";
        }

        if (!passwordData.newPassword) {
            newErrors.newPassword = "New password is required";
        } else if (passwordData.newPassword.length < 6) {
            newErrors.newPassword = "Password must be at least 6 characters";
        }

        if (!passwordData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your new password";
        } else if (passwordData.newPassword !== passwordData.confirmPassword) {
            newErrors.confirmPassword = "Passwords don't match";
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
            newErrors.newPassword =
                "New password must be different from current password";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveProfile = async () => {
        if (!validateProfileForm()) return;

        try {
            const response = await axiosInstance.put(
                "/api/auth/update",
                {
                    name: profileData.name,
                    email: session.user.email, // Send current email for identification
                },
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                    },
                },
            );

            // Call the `update` function from `useSession` to refresh the session with new user data
            update({
                name: profileData.name,
            });

            setIsEditingProfile(false);
            showToast?.success(
                "Profile updated successfully!",
                response.data.message,
            );
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast?.error(
                "Failed to update profile.",
                error.response?.data?.message || "Please try again.",
            );
        }
    };

    const handleChangePassword = async () => {
        if (!validatePasswordForm()) return;

        try {
            const response = await axiosInstance.put(
                "/api/auth/password",
                {
                    email: session.user.email,
                    oldpassword: passwordData.currentPassword,
                    password: passwordData.newPassword,
                },
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                    },
                },
            );

            console.log(response);

            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
            setIsChangingPassword(false);
            showToast?.success(
                "Password changed successfully!",
                response.data.message,
            );
        } catch (error) {
            console.error("Error changing password:", error);
            showToast?.error(
                "Failed to change password.",
                error.response?.data?.message || "Please try again.",
            );
        }
    };

    const handleCancelProfileEdit = () => {
        setProfileData({
            name: session?.user?.name || "",
            email: session?.user?.email || "",
        });
        setIsEditingProfile(false);
        setErrors({});
    };

    const handleCancelPasswordChange = () => {
        setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
        setIsChangingPassword(false);
        setErrors({});
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords((prev) => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    if (isLoading || status === "loading") {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    return (
        <div className={styles.profileContainer}>
            <div className={styles.profileHeader}>
                <button className={styles.backButton} onClick={() => router.push("/")}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Back to Home
                </button>
                <h1 className={styles.pageTitle}>Profile Settings</h1>
            </div>

            <div className={styles.profileContent}>
                {/* Profile Information Card */}
                <div className={styles.profileCard}>
                    <h3 className={styles.cardTitle}>Profile Information</h3>

                    {isEditingProfile ? (
                        <div className={styles.editForm}>
                            <div className={styles.formGroup}>
                                <label htmlFor="name">Full Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={profileData.name}
                                    onChange={handleProfileInputChange}
                                    className={`${styles.formInput} ${errors.name ? styles.error : ""}`}
                                />
                                {errors.name && (
                                    <span className={styles.errorText}>{errors.name}</span>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={profileData.email}
                                    readOnly
                                    disabled
                                    className={`${styles.formInput} ${styles.disabled}`}
                                />
                                <span className={styles.infoText}>
                                    Email cannot be changed.
                                </span>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={handleCancelProfileEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.saveButton}
                                    onClick={handleSaveProfile}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.profileDetails}>
                            <div className={styles.profileField}>
                                <label>Name</label>
                                <span>{session?.user?.name}</span>
                            </div>
                            <div className={styles.profileField}>
                                <label>Email</label>
                                <span>{session?.user?.email}</span>
                            </div>
                            <button
                                className={styles.editButton}
                                onClick={() => setIsEditingProfile(true)}
                            >
                                Edit Profile
                            </button>
                        </div>
                    )}
                </div>

                {/* Change Password Card */}
                <div className={styles.profileCard}>
                    <h3 className={styles.cardTitle}>Change Password</h3>

                    {isChangingPassword ? (
                        <div className={styles.editForm}>
                            <div className={styles.formGroup}>
                                <label htmlFor="currentPassword">Current Password</label>
                                <div className={styles.passwordWrapper}>
                                    <input
                                        type={showPasswords.current ? "text" : "password"}
                                        id="currentPassword"
                                        name="currentPassword"
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordInputChange}
                                        className={`${styles.formInput} ${errors.currentPassword ? styles.error : ""}`}
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => togglePasswordVisibility("current")}
                                    >
                                        <FontAwesomeIcon
                                            icon={showPasswords.current ? faEyeSlash : faEye}
                                        />
                                    </button>
                                </div>
                                {errors.currentPassword && (
                                    <span className={styles.errorText}>
                                        {errors.currentPassword}
                                    </span>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="newPassword">New Password</label>
                                <div className={styles.passwordWrapper}>
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        id="newPassword"
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordInputChange}
                                        className={`${styles.formInput} ${errors.newPassword ? styles.error : ""}`}
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => togglePasswordVisibility("new")}
                                    >
                                        <FontAwesomeIcon
                                            icon={showPasswords.new ? faEyeSlash : faEye}
                                        />
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <span className={styles.errorText}>{errors.newPassword}</span>
                                )}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="confirmPassword">Confirm New Password</label>
                                <div className={styles.passwordWrapper}>
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordInputChange}
                                        className={`${styles.formInput} ${errors.confirmPassword ? styles.error : ""}`}
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => togglePasswordVisibility("confirm")}
                                    >
                                        <FontAwesomeIcon
                                            icon={showPasswords.confirm ? faEyeSlash : faEye}
                                        />
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <span className={styles.errorText}>
                                        {errors.confirmPassword}
                                    </span>
                                )}
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={handleCancelPasswordChange}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.saveButton}
                                    onClick={handleChangePassword}
                                >
                                    Change Password
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.passwordSection}>
                            <p className={styles.passwordDescription}>
                                Keep your account secure by using a strong password
                            </p>
                            <button
                                className={styles.changePasswordButton}
                                onClick={() => setIsChangingPassword(true)}
                            >
                                Change Password
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
