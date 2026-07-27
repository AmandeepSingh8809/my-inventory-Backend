const express = require("express");
const router = express.Router();
const saleController = require("../controllers/salesController");

router.post("/sales/bulk", saleController.processBulkSale);
router.get("/sales/today", saleController.getTodayStats);
router.get("/sales/history",saleController.fetchSalesHistory);
module.exports = router;
