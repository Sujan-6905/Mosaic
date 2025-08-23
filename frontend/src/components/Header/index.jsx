"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useDispatch } from "react-redux"
import { headerItemClick } from "@/slice/headerSlice"
import { useSession, signOut } from "next-auth/react"
import {
    faUser,
    faDownload,
    faShare,
    faUsers,
    faSignOutAlt,
    faChevronDown,
    faExpand,
    faCompress,
    faArrowLeft,
    faDashboard,
    faTrash,
} from "@fortawesome/free-solid-svg-icons"
import styles from "./index.module.css"
import axiosInstance from "@/axiosInstance"

// New CollaboratorList component
const CollaboratorsList = ({ collaborators, handleDeleteCollaborator, isFetchingCollaborators, isOwner }) => {
    return (
        <div className={styles.collaboratorsList}>
            <div className={styles.collaboratorsListHeader}>
                <h4>Current Collaborators</h4>
            </div>
            {isFetchingCollaborators ? (
                <div className={styles.loadingMessage}>
                    <p>Loading collaborators...</p>
                </div>
            ) : collaborators.length > 0 ? (
                <ul className={styles.collaborators}>
                    {collaborators.map((collaborator) => (
                        <li key={collaborator._id} className={styles.collaboratorItem}>
                            <div className={styles.collaboratorAvatar}>
                                {collaborator.email[0].toUpperCase()}
                            </div>
                            <span className={styles.collaboratorEmail}>{collaborator.email}</span>
                            {isOwner && (
                                <button
                                    className={styles.deleteCollaboratorButton}
                                    onClick={() => handleDeleteCollaborator(collaborator.email)}
                                    title="Remove collaborator"
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className={styles.emptyMessage}>
                    <p>No collaborators have been added yet.</p>
                </div>
            )}
        </div>
    )
}

const Header = ({ onAuthClick, showToast }) => {
    const router = useRouter()
    const dispatch = useDispatch()
    const { data: session, status } = useSession()

    const isAuthenticated = status === "authenticated"
    const user = session?.user || null
    const token = session?.accessToken || null

    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false)
    const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("")
    const [collaborators, setCollaborators] = useState([])
    const [isFetchingCollaborators, setIsFetchingCollaborators] = useState(false)
    const [isOwner, setIsOwner] = useState(false); // New state for ownership

    const isWhiteboardPage = router.pathname === "/" && router.query.shareId && isAuthenticated
    const showBackButton = router.pathname !== "/" && isAuthenticated

    // UseEffect to check fullscreen status and update state
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        if (isWhiteboardPage && token) {
            fetchDrawingDetails()
        }
    }, [isWhiteboardPage, token])

    useEffect(() => {
        if (isCollaboratorsModalOpen && token) {
            fetchCollaborators()
        }
    }, [isCollaboratorsModalOpen, token])

    const fetchDrawingDetails = async () => {
        const shareId = router.query.shareId
        if (!shareId || !token) return
        try {
            const response = await axiosInstance.get(`/api/drawing/getById/${shareId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            console.log("drawing details", response.data);
            // Set isOwner based on if the current user ID matches the drawing's owner ID
            // The backend should return the owner's ID
            setIsOwner(response.data.data.owner === user.id)
        } catch (error) {
            console.error("Error fetching drawing details:", error)
            showToast?.error("Error", error.response?.data?.message || "Failed to fetch drawing details.")
        }
    }

    const fetchCollaborators = async () => {
        const shareId = router.query.shareId
        if (!shareId || !token) return
        setIsFetchingCollaborators(true)
        try {
            const response = await axiosInstance.get(
                `/api/drawing/collaborators/${shareId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )
            setCollaborators(response.data.collaborators)
        } catch (error) {
            console.error("Error fetching collaborators:", error)
            showToast?.error("Error", error.response?.data?.message || "Failed to fetch collaborators.")
        } finally {
            setIsFetchingCollaborators(false)
        }
    }

    const toggleUserMenu = () => {
        setIsUserMenuOpen(!isUserMenuOpen)
    }

    const handleFeatureClick = (featureName) => {
        if (featureName === "Share") {
            setIsShareModalOpen(true)
        } else if (featureName === "Collaborators") {
            setIsCollaboratorsModalOpen(true)
        } else {
            showToast?.info("Coming Soon", `${featureName} feature is yet to be implemented`)
        }
        dispatch(headerItemClick(featureName))
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const handleAddCollaborator = async () => {
        if (!isOwner) {
            showToast?.error("Permission Denied", "Only the owner can add collaborators.")
            return
        }

        const shareId = router.query.shareId
        if (!shareId) {
            showToast?.error("Error", "No whiteboard ID found.")
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newCollaboratorEmail)) {
            showToast?.error("Invalid Email", "Please enter a valid email address.")
            return
        }

        if (!token) {
            showToast?.error("Authentication Error", "You are not authenticated.")
            return
        }

        try {
            const response = await axiosInstance.put(
                `/api/drawing/collaborators/${shareId}`,
                { email: newCollaboratorEmail },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (response.status === 200) {
                showToast?.success("Success", "Collaborator added successfully!")
                setNewCollaboratorEmail("")
                fetchCollaborators()
            }
        } catch (error) {
            console.error("Failed to add collaborator:", error)
            showToast?.error("Error", error.response?.data?.message || "Failed to add collaborator.")
        }
    }

    const handleDeleteCollaborator = async (emailToDelete) => {
        if (!isOwner) {
            showToast?.error("Permission Denied", "Only the owner can remove collaborators.")
            return
        }

        const shareId = router.query.shareId
        if (!shareId || !token) {
            showToast?.error("Error", "Cannot delete collaborator without whiteboard ID or token.")
            return
        }

        try {
            const response = await axiosInstance.delete(
                `/api/drawing/collaborators/${shareId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    data: {
                        email: emailToDelete,
                    },
                }
            )

            if (response.status === 200) {
                showToast?.success("Success", "Collaborator removed successfully!")
                fetchCollaborators()
            }
        } catch (error) {
            console.error("Failed to remove collaborator:", error)
            showToast?.error("Error", error.response?.data?.message || "Failed to remove collaborator.")
        }
    }

    const handleProfileClick = () => {
        setIsUserMenuOpen(false)
        router.push("/profile")
    }

    const handleDashboardClick = () => {
        setIsUserMenuOpen(false)
        router.push("/dashboard")
    }

    const handleBackToHome = () => {
        router.push("/")
    }

    const handleAboutClick = () => {
        router.push("/about")
    }

    const handleLogout = () => {
        signOut({ callbackUrl: "/" });
        showToast.info("Signed out", "You have been successfully signed out");
    };

    return (
        <>
            <header className={styles.header}>
                <div className={styles.container}>
                    <div className={styles.leftSection}>
                        {showBackButton && (
                            <button className={styles.backButton} onClick={handleBackToHome} title="Back to home">
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </button>
                        )}
                        <div className={styles.logo} onClick={handleBackToHome}>
                            <div className={styles.logoIcon}></div>
                            <span className={styles.logoText}>Whiteboard</span>
                        </div>
                        {isWhiteboardPage && (
                            <div className={styles.quickActions}>
                                <button
                                    className={styles.quickButton}
                                    onClick={toggleFullscreen}
                                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                                >
                                    <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                                </button>
                            </div>
                        )}
                    </div>

                    {isWhiteboardPage && (
                        <div className={styles.centerSection}>
                            <div className={styles.actionGroup}>
                                <button
                                    className={styles.actionButton}
                                    onClick={() => handleFeatureClick("Export")}
                                    title="Export whiteboard"
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    <span>Export</span>
                                </button>
                                <button
                                    className={styles.actionButton}
                                    onClick={() => handleFeatureClick("Share")}
                                    title="Share whiteboard"
                                >
                                    <FontAwesomeIcon icon={faShare} />
                                    <span>Share</span>
                                </button>
                                <button
                                    className={styles.actionButton}
                                    onClick={() => handleFeatureClick("Collaborators")}
                                    title="Manage collaborators"
                                >
                                    <FontAwesomeIcon icon={faUsers} />
                                    <span>Collaborators</span>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.rightSection}>
                        {isAuthenticated ? (
                            <div className={styles.userMenu}>
                                <button className={styles.userButton} onClick={toggleUserMenu}>
                                    <div className={styles.userAvatar}>
                                        <FontAwesomeIcon icon={faUser} />
                                    </div>
                                    <div className={styles.userInfo}>
                                        <span className={styles.userName}>{user?.name || "User"}</span>
                                        <span className={styles.userEmail}>{user?.email || "user@example.com"}</span>
                                    </div>
                                    <FontAwesomeIcon icon={faChevronDown} className={styles.chevron} />
                                </button>
                                {isUserMenuOpen && (
                                    <>
                                        <div className={styles.userDropdown}>
                                            <div className={styles.dropdownHeader}>
                                                <div className={styles.dropdownAvatar}>
                                                    <FontAwesomeIcon icon={faUser} />
                                                </div>
                                                <div className={styles.dropdownUserInfo}>
                                                    <div className={styles.dropdownUserName}>{user?.name || "User"}</div>
                                                    <div className={styles.dropdownUserEmail}>{user?.email || "user@example.com"}</div>
                                                </div>
                                            </div>
                                            <div className={styles.dropdownDivider}></div>
                                            <button className={styles.dropdownItem} onClick={handleProfileClick}>
                                                <FontAwesomeIcon icon={faUser} />
                                                Profile
                                            </button>
                                            <button className={styles.dropdownItem} onClick={handleDashboardClick}>
                                                <FontAwesomeIcon icon={faDashboard} />
                                                My Drawings
                                            </button>
                                            <div className={styles.dropdownDivider}></div>
                                            <button className={styles.dropdownItem} onClick={handleAboutClick}>
                                                About
                                            </button>
                                            <button className={styles.dropdownItem} onClick={handleLogout}>
                                                <FontAwesomeIcon icon={faSignOutAlt} />
                                                Sign Out
                                            </button>
                                        </div>
                                        <div className={styles.dropdownOverlay} onClick={() => setIsUserMenuOpen(false)} />
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className={styles.authButtons}>
                                <button className={styles.loginButton} onClick={() => onAuthClick("login")}>
                                    Sign In
                                </button>
                                <button className={styles.registerButton} onClick={() => onAuthClick("register")}>
                                    Get Started
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Share Modal */}
            {isShareModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsShareModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Share Whiteboard</h3>
                            <button className={styles.closeButton} onClick={() => setIsShareModalOpen(false)}>
                                ×
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.shareSection}>
                                <label>Share Link</label>
                                <div className={styles.linkContainer}>
                                    <input
                                        type="text"
                                        value={`${window.location.origin}${router.asPath}`}
                                        readOnly
                                        className={styles.linkInput}
                                    />
                                    <button
                                        className={styles.copyButton}
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}${router.asPath}`)
                                            showToast?.success("Copied!", "Link copied to clipboard")
                                        }}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className={styles.shareNote}>Anyone with this link can view and edit the whiteboard</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Collaborators Modal */}
            {isCollaboratorsModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsCollaboratorsModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>{isOwner ? "Manage Collaborators" : "View Collaborators"}</h3>
                            <button className={styles.closeButton} onClick={() => setIsCollaboratorsModalOpen(false)}>
                                ×
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            {isOwner && (
                                <div className={styles.collaboratorSection}>
                                    <label>Add Collaborator</label>
                                    <div className={styles.addCollaboratorContainer}>
                                        <input
                                            type="email"
                                            placeholder="Enter email address..."
                                            className={styles.emailInput}
                                            value={newCollaboratorEmail}
                                            onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                                        />
                                        <button className={styles.addButton} onClick={handleAddCollaborator}>Add</button>
                                    </div>
                                    <p className={styles.collaboratorNote}>Collaborators will be able to view and edit this whiteboard</p>
                                </div>
                            )}
                            <CollaboratorsList
                                collaborators={collaborators}
                                handleDeleteCollaborator={handleDeleteCollaborator}
                                isFetchingCollaborators={isFetchingCollaborators}
                                isOwner={isOwner}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default Header;
