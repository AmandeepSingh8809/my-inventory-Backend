const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const verifyToken = require('../middleware/authMiddleware');
const { requireShopPermission } = require('../middleware/authorize'); // 👈 1. Import the middleware

// 2. Lock down the route to only those who can view financials
router.get(
  "/finance/summary",
  verifyToken,
  requireShopPermission('view_financials'), 
  financeController.fetchFinancialSummary
);

module.exports = router;