const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");

router.get("/finance/summary", financeController.fetchFinancialSummary);

module.exports = router;