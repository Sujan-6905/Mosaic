import createMemoryStore from "../memoryStore.js";
import runStoreContractTests from "./storeContract.js";

runStoreContractTests("memoryStore", createMemoryStore);
