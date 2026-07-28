const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");

// Matches frontend: /api/purchases/history
router.get("/purchases/history", purchaseController.fetchPurchases);

module.exports = router;