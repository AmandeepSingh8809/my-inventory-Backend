const express = require("express");
const router = express.Router();
const saleController = require("../controllers/salesController");
const verifyToken = require('../middleware/authMiddleware');
const { requireShopPermission, requireAnyShopPermission } = require('../middleware/authorize'); // 👈 1. Import authorization

// 2. CREATE A SALE: Both Managers and Salesmen have this exact permission. Stockists do not.
router.post(
  "/sales/bulk",
  verifyToken, 
  requireShopPermission('create_sale'),
  saleController.processBulkSale
);

// 3. TODAY's STATS: We use `requireAnyShopPermission` so both Managers AND Salesmen can get in.
router.get(
  "/sales/today",
  verifyToken, 
  requireAnyShopPermission(['view_sales', 'view_own_sales']),
  saleController.getTodayStats
);

// 4. SALES HISTORY: Again, let both roles in (Stockists are blocked because they have neither permission).
router.get(
  "/sales/history",
  verifyToken,
  requireAnyShopPermission(['view_sales', 'view_own_sales']),
  saleController.fetchSalesHistory
);

module.exports = router;