const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireGlobalRole } = require('../middleware/authorize'); 
const { GLOBAL_ROLES } = require('../config/permissions'); 

const { getMyShops, createNewShop } = require('../controllers/shopController');

// 1. ALL authenticated users need to see their shops to load the app.
// No extra permission needed beyond being logged in.
router.get(
  '/users/my-shops', 
  verifyToken, 
  getMyShops
);

// 2. ONLY global Owners and Admins can create entirely new shops.
router.post(
  '/shops/create', 
  verifyToken, 
  requireGlobalRole([GLOBAL_ROLES.OWNER, GLOBAL_ROLES.ADMIN]), 
  createNewShop
);

module.exports = router;