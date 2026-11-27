import { requireFromBackend } from "./packageResolution.js";

// Imported before anything from the backend, which reads some settings as it loads.
requireFromBackend("dotenv").config({ path: new URL("../backend/.env", import.meta.url).pathname, quiet: true });
