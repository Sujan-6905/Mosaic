// Lets REST controllers push socket events without a circular import of the server setup.
let io = null;

const setIo = (server) => {
    io = server;
};

const getIo = () => io;

export { setIo, getIo };
