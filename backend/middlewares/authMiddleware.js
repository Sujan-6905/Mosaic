import jwt from "jsonwebtoken";

const authCheck = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { userId: decoded.userId };

    next();
  } catch (error) {
    return res
      .status(400)
      .json({ message: "error validating jwt token", error });
  }
};

export default authCheck;
