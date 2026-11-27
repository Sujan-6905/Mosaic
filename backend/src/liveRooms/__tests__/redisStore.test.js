import RedisMock from "ioredis-mock";
import createRedisStore from "../redisStore.js";
import runStoreContractTests from "./storeContract.js";

// ioredis-mock shares one backing store per connection signature, so a unique port gives
// each createStore() its own.
let nextPort = 40000;
runStoreContractTests("redisStore", () => createRedisStore(new RedisMock(nextPort++)));
