import dynamic from "next/dynamic";
import ExportDialog from "../exportImport/ExportDialog.jsx";
import AgentsDialog from "../sharing/AgentsDialog.jsx";
import EmbedBoardDialog from "../sharing/EmbedBoardDialog.jsx";
import ImportDialog from "../exportImport/ImportDialog.jsx";
import EmbedDialog from "../embeds/EmbedDialog.jsx";
import RestylePanel from "../diagrams/RestylePanel.jsx";
import PiecesPanel from "../pieces/PiecesPanel.jsx";
import BoardPropertiesDialog from "../chrome/BoardPropertiesDialog.jsx";
import ClearBoardDialog from "../chrome/ClearBoardDialog.jsx";

// Loaded on first use, and only in the browser, since most sessions never open it.
const MermaidDialog = dynamic(() => import("../diagrams/MermaidDialog.jsx"), { ssr: false });

export default function BoardDialogs({ board }) {
    const {
        boardPropertiesOpen,
        buildMermaid,
        deleteSet,
        dropPiece,
        exportSet,
        importSetFile,
        installFromLink,
        listSet,
        pieceSets,
        piecesOpen,
        piecesSaving,
        placePiece,
        refreshPieces,
        removePiece,
        renameSet,
        restyleOpen,
        restyleSelected,
        saveSelectionAsPiece,
        setPiecesOpen,
        setRestyleOpen,
        setPiecesSaving,
        shareSet,
        stopSharingSet,
        unlistSet,
        cameraRef,
        embedDialogOpen,
        mermaidOpen,
        placeMermaid,
        setMermaidOpen,
        insertEmbed,
        setBoardPropertiesOpen,
        setEmbedDialogOpen,
        background,
        clearBoardBusy,
        clearBoardOpen,
        clearBoardTitle,
        collaborators,
        comments,
        elements,
        exportDialogOpen,
        agentsDialogOpen,
        setAgentsDialogOpen,
        embedBoardDialog,
        setEmbedBoardDialog,
        handleConfirmClearBoard,
        handleExport,
        handleImportMerge,
        handleImportNewBoard,
        hasEditAccess,
        importDialogOpen,
        role,
        selectedElementIds,
        session,
        setClearBoardOpen,
        setExportDialogOpen,
        setImportDialogOpen,
        shareId,
        showToast,
        rasterForExport,
    } = board;

    return (
        <>
            <ExportDialog
                isOpen={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                elements={elements}
                background={background}
                selectedElementIds={selectedElementIds}
                onExport={handleExport}
                rasterFor={rasterForExport}
            />
            <AgentsDialog
                isOpen={agentsDialogOpen}
                onClose={() => setAgentsDialogOpen(false)}
                shareId={shareId}
                token={session?.accessToken}
                canEdit={hasEditAccess}
                showToast={showToast}
            />
            <EmbedBoardDialog
                isOpen={Boolean(embedBoardDialog)}
                onClose={() => setEmbedBoardDialog(null)}
                shareId={shareId}
                token={session?.accessToken}
                isOwner={role === "owner"}
                elements={elements}
                initialFrameId={embedBoardDialog?.frameId}
                showToast={showToast}
            />
            <ImportDialog
                isOpen={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                canEdit={role === "editor" || role === "owner"}
                onImportNew={handleImportNewBoard}
                onImportMerge={handleImportMerge}
            />
            <EmbedDialog isOpen={embedDialogOpen} onClose={() => setEmbedDialogOpen(false)} onInsert={(url) => insertEmbed(url)} />
            <RestylePanel
                isOpen={restyleOpen}
                onClose={() => setRestyleOpen(false)}
                elements={elements}
                selectedElementIds={selectedElementIds}
                onApply={restyleSelected}
            />
            <PiecesPanel
                isOpen={piecesOpen}
                onClose={() => setPiecesOpen(false)}
                canEdit={hasEditAccess}
                selectionCount={selectedElementIds.length}
                saving={piecesSaving}
                setSaving={setPiecesSaving}
                pieces={{
                    deleteSet,
                    dropPiece,
                    exportSet,
                    importSetFile,
                    installFromLink,
                    pieceSets,
                    placePiece,
                    refreshPieces,
                    removePiece,
                    renameSet,
                    saveSelectionAsPiece,
                    shareSet,
                    stopSharingSet,
                    listSet,
                    unlistSet,
                }}
            />
            {mermaidOpen && <MermaidDialog isOpen={mermaidOpen} onClose={() => setMermaidOpen(false)} buildMermaid={buildMermaid} onPlace={placeMermaid} />}
            <BoardPropertiesDialog
                isOpen={boardPropertiesOpen}
                onClose={() => setBoardPropertiesOpen(false)}
                shareId={shareId}
                token={session?.accessToken}
                elements={elements}
                comments={comments}
                collaboratorCount={collaborators.length}
                selectionCount={selectedElementIds.length}
                zoom={cameraRef.current.zoom}
            />
            <ClearBoardDialog
                isOpen={clearBoardOpen}
                onClose={() => setClearBoardOpen(false)}
                boardTitle={clearBoardTitle}
                isOwner={role === "owner"}
                onConfirm={handleConfirmClearBoard}
                busy={clearBoardBusy}
            />
        </>
    );
}
