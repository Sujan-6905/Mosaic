import "../db/connection.js";
import { Schema, model } from "ottoman";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        username: { type: String, required: true },
        password: String,

        // Provider sign-ups keep the email for account linking only; it's never shown as identity.
        email: String,
        oauthProvider: { type: String }, // e.g. "google", "github"
        oauthId: { type: String },

        // null means "no explicit choice yet", so the client falls back
        // to OS preference on first visit rather than a hardcoded default.
        themePreference: { type: String, default: null },
        // Hashes of the single-use codes that can replace a forgotten password.
        recoveryCodes: { type: [String], default: [] },
    },
    { timestamps: true },
);

// For lookups only: username uniqueness comes from a reserved-key insert (usernameSchema.js).
userSchema.index.findByUsername = { by: "username", type: "n1ql" };
userSchema.index.findByEmail = { by: "email", type: "n1ql" };
userSchema.index.findByOAuthId = { by: "oauthId", type: "n1ql" };

// toJSON() runs on every response path that JSON.stringify()s a User doc -
// strips auth secrets once here rather than at each call site.
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.recoveryCodes;
    return obj;
};

// Let failures reach the caller's try/catch instead of reporting success.
userSchema.statics.register = async function (username, password, extra = {}) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    return this.create({ username, password: hashedPassword, ...extra });
};

userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = async function (password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

const User = model("User", userSchema, {
    collectionName: "users",
    scopeName: "app",
    idKey: "_id",
});

export default User;
