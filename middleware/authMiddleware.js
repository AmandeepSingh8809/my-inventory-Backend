const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access Denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_inventory_key');
    req.user = verified; // This attaches { id, username, role, shopCode } to the request!
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

module.exports = verifyToken;