"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPlus,
    faEdit,
    faUsers,
    faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons"; // Added faExclamationTriangle
import axiosInstance from "@/axiosInstance";
import { useSession, signOut } from "next-auth/react";
import DrawingCard from "@/components/DrawingCard/index.js";
import styles from "./index.module.css";

const Dashboard = ({ showToast }) => {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [drawings, setDrawings] = useState({
        ownedDrawings: [],
        sharedWithDrawings: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("owned");

    // State for modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false); // New state for delete modal
    const [editingDrawing, setEditingDrawing] = useState(null);
    const [drawingToDeleteId, setDrawingToDeleteId] = useState(null); // New state for drawing to delete
    const [newTitle, setNewTitle] = useState("");

    useEffect(() => {
        if (status === "authenticated") {
            fetchDrawings();
        } else if (status === "unauthenticated") {
            // Redirect to home or login if not authenticated
            router.push("/");
            showToast?.error("Access Denied", "Kindly login to view your dashboard.");
        }
    }, [status]); // Depend on status to re-run when authentication state changes

    const fetchDrawings = async () => {
        setIsLoading(true);
        try {
            const response = await axiosInstance.get(`/api/drawing/get`, {
                headers: {
                    Authorization: `Bearer ${session.accessToken}`,
                },
            });
            setDrawings(response.data.data);
        } catch (error) {
            console.error("Error fetching drawings:", error);
            showToast?.error("Error", "Failed to fetch drawings");
            // If token is expired or invalid, sign out the user
            if (error.response?.status === 401) {
                signOut({ redirect: false });
                router.push("/");
                showToast.info(
                    "Signed out",
                    "Your session has expired. Please log in again.",
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDrawing = () => {
        setNewTitle(`Untitled Drawing ${new Date().toLocaleDateString()}`);
        setShowCreateModal(true);
    };

    const confirmCreateDrawing = async () => {
        if (newTitle.trim() === "") {
            showToast?.error("Error", "Title cannot be empty");
            return;
        }

        try {
            const response = await axiosInstance.post(
                "/api/drawing/create",
                {
                    title: newTitle,
                    userId: session.user.id,
                },
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                    },
                },
            );

            const newDrawing = response.data.data;
            router.push(`/?shareId=${newDrawing.shareId}`);
            showToast?.success("Drawing Created", "New drawing created successfully");
        } catch (error) {
            console.error("Error creating drawing:", error);
            showToast?.error("Error", "Failed to create drawing");
        } finally {
            setShowCreateModal(false);
            setNewTitle("");
        }
    };

    const handleEditDrawingTitle = (drawing) => {
        setEditingDrawing(drawing);
        setNewTitle(drawing.title);
        setShowEditModal(true);
    };

    const confirmEditDrawingTitle = async () => {
        if (newTitle.trim() === "") {
            showToast?.error("Error", "Title cannot be empty");
            return;
        }
        if (newTitle === editingDrawing.title) {
            setShowEditModal(false);
            return;
        }

        try {
            await axiosInstance.put(
                `/api/drawing/update/${editingDrawing._id}`,
                { newTitle }, // Sending title in request body
                {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                    },
                },
            );

            setDrawings((prev) => ({
                ...prev,
                ownedDrawings: prev.ownedDrawings.map((d) =>
                    d._id === editingDrawing._id ? { ...d, title: newTitle } : d,
                ),
            }));

            showToast?.success("Title Updated", "Drawing title updated successfully");
        } catch (error) {
            console.error("Error updating title:", error);
            showToast?.error("Error", "Failed to update title");
        } finally {
            setShowEditModal(false);
            setEditingDrawing(null);
            setNewTitle("");
        }
    };

    // Modified handleDeleteDrawing to show modal
    const handleDeleteDrawing = (drawingId) => {
        setDrawingToDeleteId(drawingId);
        setShowDeleteModal(true);
    };

    // New function to confirm and execute deletion
    const confirmDeleteDrawing = async () => {
        if (!drawingToDeleteId) return; // Should not happen if modal is properly controlled

        try {
            await axiosInstance.delete(`/api/drawing/delete/${drawingToDeleteId}`, {
                headers: {
                    Authorization: `Bearer ${session.accessToken}`,
                },
            });

            setDrawings((prev) => ({
                ...prev,
                ownedDrawings: prev.ownedDrawings.filter(
                    (d) => d._id !== drawingToDeleteId,
                ),
            }));

            showToast?.success("Drawing Deleted", "Drawing deleted successfully");
        } catch (error) {
            console.error("Error deleting drawing:", error);
            showToast?.error("Error", "Failed to delete drawing");
        } finally {
            setShowDeleteModal(false);
            setDrawingToDeleteId(null);
        }
    };

    const handleShareDrawing = (shareId) => {
        const shareUrl = `${window.location.origin}/?shareId=${shareId}`;
        // Using document.execCommand('copy') for better iframe compatibility
        const el = document.createElement("textarea");
        el.value = shareUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        showToast?.success("Link Copied", "Share link copied to clipboard");
    };

    const handleOpenDrawing = (shareId) => {
        router.push(`/?shareId=${shareId}`);
    };

    if (isLoading || status === "loading") {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading your drawings...</p>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            <div className={styles.dashboardHeader}>
                <div className={styles.headerContent}>
                    <h1 className={styles.pageTitle}>My Drawings</h1>
                    <p className={styles.pageSubtitle}>
                        Create, manage, and share your whiteboards
                    </p>
                </div>
                <button className={styles.createButton} onClick={handleCreateDrawing}>
                    <FontAwesomeIcon icon={faPlus} />
                    New Drawing
                </button>
            </div>

            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tab} ${activeTab === "owned" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("owned")}
                >
                    <FontAwesomeIcon icon={faEdit} />
                    My Drawings ({drawings.ownedDrawings.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "shared" ? styles.activeTab : ""}`}
                    onClick={() => setActiveTab("shared")}
                >
                    <FontAwesomeIcon icon={faUsers} />
                    Shared with Me ({drawings.sharedWithDrawings.length})
                </button>
            </div>

            <div className={styles.drawingsGrid}>
                {activeTab === "owned" && (
                    <>
                        {drawings.ownedDrawings.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>
                                    <FontAwesomeIcon icon={faEdit} />
                                </div>
                                <h3>No drawings yet</h3>
                                <p>Create your first drawing to get started</p>
                                <button
                                    className={styles.createButton}
                                    onClick={handleCreateDrawing}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                    Create Drawing
                                </button>
                            </div>
                        ) : (
                            drawings.ownedDrawings.map((drawing) => (
                                <DrawingCard
                                    key={drawing._id}
                                    drawing={drawing}
                                    onOpen={() => handleOpenDrawing(drawing.shareId)}
                                    onShare={() => handleShareDrawing(drawing.shareId)}
                                    onDelete={() => handleDeleteDrawing(drawing._id)} // Now opens the modal
                                    onEditTitle={() => handleEditDrawingTitle(drawing)}
                                    isOwner={true}
                                />
                            ))
                        )}
                    </>
                )}

                {activeTab === "shared" && (
                    <>
                        {drawings.sharedWithDrawings.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>
                                    <FontAwesomeIcon icon={faUsers} />
                                </div>
                                <h3>No shared drawings</h3>
                                <p>Drawings shared with you will appear here</p>
                            </div>
                        ) : (
                            drawings.sharedWithDrawings.map((drawing) => (
                                <DrawingCard
                                    key={drawing._id}
                                    drawing={drawing}
                                    onOpen={() => handleOpenDrawing(drawing.shareId)}
                                    onShare={() => handleShareDrawing(drawing.shareId)}
                                    isOwner={false}
                                />
                            ))
                        )}
                    </>
                )}
            </div>

            {/* Create Drawing Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Create New Drawing</h3>
                            <button
                                className={styles.closeButton}
                                onClick={() => setShowCreateModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="newTitle">Drawing Title</label>
                                <input
                                    id="newTitle"
                                    type="text"
                                    className={styles.textInput}
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") confirmCreateDrawing();
                                    }}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.confirmButton}
                                    onClick={confirmCreateDrawing}
                                >
                                    Create Drawing
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Drawing Modal */}
            {showEditModal && editingDrawing && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Edit Drawing Title</h3>
                            <button
                                className={styles.closeButton}
                                onClick={() => setShowEditModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.inputGroup}>
                                <label htmlFor="editTitle">New Title</label>
                                <input
                                    id="editTitle"
                                    type="text"
                                    className={styles.textInput}
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") confirmEditDrawingTitle();
                                    }}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={() => setShowEditModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.confirmButton}
                                    onClick={confirmEditDrawingTitle}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>Confirm Deletion</h3>
                            <button
                                className={styles.closeButton}
                                onClick={() => setShowDeleteModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.deleteWarning}>
                                <div className={styles.warningIcon}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                </div>
                                <div className={styles.warningContent}>
                                    <h4>Are you sure you want to delete this drawing?</h4>
                                    <p>This action cannot be undone.</p>
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    className={styles.cancelButton}
                                    onClick={() => setShowDeleteModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.deleteButton}
                                    onClick={confirmDeleteDrawing}
                                >
                                    Delete Drawing
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;