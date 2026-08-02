const express = require("express");
const router = express.Router();
const saleController = require("../controllers/salesController");
const  verifyToken = require('../middleware/authMiddleware');

router.post("/sales/bulk",verifyToken, saleController.processBulkSale);
router.get("/sales/today",verifyToken, saleController.getTodayStats);
router.get("/sales/history",verifyToken,saleController.fetchSalesHistory);
module.exports = router;
