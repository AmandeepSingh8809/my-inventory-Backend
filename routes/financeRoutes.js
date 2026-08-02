const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const  verifyToken = require('../middleware/authMiddleware');

router.get("/finance/summary",verifyToken, financeController.fetchFinancialSummary);

module.exports = router;