const express = require("express");
const router = express.Router();
const saleController = require("../controllers/salesController");

router.post("/", saleController.processSale);

module.exports = router;