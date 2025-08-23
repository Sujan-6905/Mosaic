import User from "../models/userSchema.js";
import jwt from "jsonwebtoken";

// Generate JWT
const generateToken = (user) => {
    const secret_key = process.env.JWT_SECRET;
    return jwt.sign({ userId: user._id }, secret_key, { expiresIn: "1h" });
};

// ------------------- REGISTER -------------------
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists, try logging in instead",
            });
        }

        const savedUser = await User.register(name, email, password);

        const token = generateToken(savedUser);

        return res.status(200).json({ user: savedUser, token });
    } catch (error) {
        return res.status(400).json({ message: "An error has occurred: " + error });
    }
};

// ------------------- LOGIN (Credentials) -------------------
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "user does not exist" });
        }

        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "wrong password" });
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: "logged in successfully",
            user,
            token,
        });
    } catch (error) {
        return res.status(400).json({ message: "An error has occurred: " + error });
    }
};

// ------------------- OAUTH LOGIN -------------------
const oauthLogin = async (req, res) => {
    try {
        const { provider, providerAccountId, email, name } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required from provider" });
        }

        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user without password
            user = new User({
                name: name || email.split("@")[0],
                email,
                oauthProvider: provider,
                oauthId: providerAccountId,
            });
            await user.save();
        }

        // If existing user doesn't have oauth info, save it
        if (!user.oauthProvider || !user.oauthId) {
            user.oauthProvider = provider;
            user.oauthId = providerAccountId;
            await user.save();
        }

        const token = generateToken(user);

        return res.status(200).json({
            message: `${provider} login successful`,
            user,
            token,
        });
    } catch (error) {
        return res.status(400).json({ message: "OAuth login failed: " + error });
    }
};

// ------------------- UPDATE PROFILE -------------------
const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "user does not exist" });
        }

        await User.updateOne({ email }, { name });

        return res.status(200).json({ message: "User profile updated successfully" });
    } catch (error) {
        return res.status(400).json({ message: "Couldn't update profile: " + error });
    }
};

// ------------------- CHANGE PASSWORD -------------------
const changePassword = async (req, res) => {
    try {
        const { email, oldpassword, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "user does not exist" });
        }

        const checkOldPassword = await user.comparePassword(oldpassword);
        if (!checkOldPassword) {
            return res.status(400).json({ message: "wrong old password" });
        }

        const hashedPassword = await User.hashPassword(password);
        await User.updateOne({ email }, { password: hashedPassword });

        return res.status(200).json({ message: "User password updated successfully" });
    } catch (error) {
        return res.status(400).json({ message: "Couldn't change user password: " + error });
    }
};

export { register, login, oauthLogin, updateProfile, changePassword };

