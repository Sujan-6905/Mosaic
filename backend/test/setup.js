// Tests mock the model layer and never touch Couchbase.
process.env.JWT_SECRET ??= "test-jwt-secret-not-for-production";

process.env.LOG_LEVEL ??= "silent";
