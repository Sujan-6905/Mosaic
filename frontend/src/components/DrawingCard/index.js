"use client";

import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faShare,
  faTrash,
  faCalendar,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./index.module.css";

const DrawingCard = ({
  drawing,
  onOpen,
  onShare,
  onDelete,
  onEditTitle,
  isOwner = true,
}) => {
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    renderPreview();
  }, [drawing, canvasRef.current, isLoading]); // is it okay to have isLoading as a dependency here?

  const renderPreview = () => {
    if (!canvasRef.current || !drawing.elements) {
      setIsLoading(false);
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const scale = 0.2; // Scale down to fit in preview

    // Set canvas size
    canvas.width = 300;
    canvas.height = 200;

    // Clear canvas with white background
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    console.log(drawing.elements);

    // Render elements if they exist
    if (drawing.elements && typeof drawing.elements === "object") {
      Object.values(drawing.elements).forEach((element) => {
        if (
          element.type === "path" &&
          element.points &&
          element.points.length > 1
        ) {
          context.save();
          context.strokeStyle = element.color || "#000000";
          context.lineWidth = (element.size || 3) * scale;
          context.lineCap = "round";
          context.lineJoin = "round";

          context.beginPath();
          context.moveTo(
            element.points[0].x * scale,
            element.points[0].y * scale,
          );

          for (let i = 1; i < element.points.length; i++) {
            context.lineTo(
              element.points[i].x * scale,
              element.points[i].y * scale,
            );
          }

          context.stroke();
          context.restore();
        }
      });
    }

    setIsLoading(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={styles.drawingCard}>
      <div className={styles.previewContainer}>
        {isLoading ? (
          <div className={styles.previewLoading}>
            <div className={styles.loadingSpinner}></div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className={styles.previewCanvas}
            onClick={onOpen}
          />
        )}
        <div className={styles.previewOverlay} onClick={onOpen}>
          <button className={styles.openButton}>
            <FontAwesomeIcon icon={faEdit} />
            Draw
          </button>
        </div>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.cardHeader}>
          <h3 className={styles.drawingTitle}>
            {drawing.title || "Untitled Drawing"}
          </h3>
          <div className={styles.cardActions}>
            {isOwner && (
              <button
                className={styles.actionButton}
                onClick={onEditTitle}
                title="Edit Title"
              >
                <FontAwesomeIcon icon={faPen} />
              </button>
            )}
            <button
              className={styles.actionButton}
              onClick={onShare}
              title="Share"
            >
              <FontAwesomeIcon icon={faShare} />
            </button>
            {isOwner && (
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={onDelete}
                title="Delete"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.cardMeta}>
          <div className={styles.metaItem}>
            <FontAwesomeIcon icon={faCalendar} />
            <span>
              {drawing.updatedAt
                ? `Updated ${formatDate(drawing.updatedAt)}`
                : `Created ${formatDate(drawing.createdAt)}`}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.elementCount}>
              {drawing.elements ? Object.values(drawing.elements).length : 0}{" "}
              elements
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingCard;
