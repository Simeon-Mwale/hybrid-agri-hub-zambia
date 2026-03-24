import jwt from "jsonwebtoken";

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "supersecret");
  } catch (e) {
    return null;
  }
}
