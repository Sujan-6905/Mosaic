import {
  saveCanvasToDB,
  loadDataFromDB,
} from "./controllers/drawingController.js";

// each canvas will have a unique shareId and the canvas state would be an array of elements painted on the canvas
const canvases = {};

// mapping each socketId to a particular canvas's shareId
const canvasAccessed = {};

const socketLogic = (io) => {
  io.on("connection", (socket) => {
    console.log("new client connected", socket.id);

    socket.on("client:createCanvas", ({ shareId }) => {
      canvases[shareId] = {
        canvasElements: {},
        activeSockets: 1,
      };

      canvasAccessed[socket.id] = shareId;
      socket.join(shareId);
    });

    socket.on("client:joinRoom", async ({ shareId }) => {
      console.log(socket.id, "called joined room with share id", shareId);
      if (!canvases[shareId]) {
        const canvasElements = await loadDataFromDB(shareId);

        if (!canvasElements) {
          socket.emit("server:canvasNotFound");
          return;
        }

        canvases[shareId] = {
          canvasElements,
          activeSockets: 1,
        };
      }

      canvasAccessed[socket.id] = shareId;

      socket.join(shareId);
      socket.emit("server:joinedRoom", canvases[shareId].canvasElements);
    });

    socket.on(
      "client:updateCanvas",
      ({ shareId, operation, elementId, element }) => {
        if (!canvases[shareId]) {
          socket.emit("server:canvasNotFound");
          return;
        }

        if (operation === "insert" || operation === "redo") {
          canvases[shareId].canvasElements.set(elementId, element);
          io.to(shareId).emit("server:addNewElement", { elementId, element });
        } else if (operation === "delete" || operation === "undo") {
          canvases[shareId].canvasElements.delete(elementId);
          io.to(shareId).emit("server:deleteElement", { elementId });
        }
      },
    );

    socket.on("disconnect", async () => {
      const canvasShareId = canvasAccessed[socket.id];

      if (canvasShareId) {
        canvases[canvasShareId].activeSockets -= 1;
        socket.leave(canvasShareId);
        delete canvasAccessed[socket.id];

        if (canvases[canvasShareId].activeSockets == 0) {
          await saveCanvasToDB({
            canvasShareId,
            canvasElements: canvases[canvasShareId].canvasElements,
          });
        }
      }
    });
  });
};

export default socketLogic;
