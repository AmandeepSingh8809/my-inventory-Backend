const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(403).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Unauthorized" });

    req.user = decoded; // Contains user ID, etc.

    // 🚨 NEW: Look for the active shop code sent by the frontend header
    const activeShopCode = req.headers["x-shop-code"];
    
    if (activeShopCode) {
       // If the frontend sent a specific shop, use that!
       req.user.shopCode = activeShopCode; 
    }

    next();
  });
};

module.exports = verifyToken;