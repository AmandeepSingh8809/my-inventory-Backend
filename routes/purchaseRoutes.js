const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const  verifyToken = require('../middleware/authMiddleware');

// Matches frontend: /api/purchases/history
router.get("/purchases/history",verifyToken, purchaseController.fetchPurchases);

module.exports = router;