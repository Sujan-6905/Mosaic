import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,

    // OAuth-specific fields
    oauthProvider: { type: String },        // e.g. "google", "github"
    oauthId: { type: String },              // Provider-specific user ID

    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationTokenExpiresAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpiresAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

userSchema.statics.register = async function(name, email, password) {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new this({
            name,
            email,
            password: hashedPassword,
        });

        const savedUser = await newUser.save();
        return savedUser;
    } catch (error) {
        console.log("error registering user", error);
    }
};

userSchema.methods.comparePassword = async function(password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        console.log("error comparing password", error);
    }
};

userSchema.statics.hashPassword = async function(password) {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    } catch (error) {
        console.log("error hashing password", error);
    }
};

const User = mongoose.model("User", userSchema);
export default User;

