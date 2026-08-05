const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const verifyToken = require('../middleware/authMiddleware');
const { requireShopPermission } = require('../middleware/authorize'); // 👈 1. Import authorization

// Matches frontend: /api/purchases/history
// 2. Lock this down to roles that handle stock and operations
router.get(
  "/purchases/history",
  verifyToken,
  requireShopPermission('manage_inventory'), 
  purchaseController.fetchPurchases
);

module.exports = router;