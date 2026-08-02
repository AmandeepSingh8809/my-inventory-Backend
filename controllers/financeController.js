const financeModel = require('../models/financeModel');

const fetchFinancialSummary = async (req, res) => {
  try {
    // Extract filters from the request query string (e.g., ?filter=1 Month)
    const { filter, startDate, endDate } = req.query;

    // 🚨 UPGRADED: Securely grab the shopCode from the authenticated token
    const shopCode = req.user.shopCode;

    // 🚨 UPGRADED: Pass the shopCode as the very first parameter to your model
    const metrics = await financeModel.getFinancialMetrics(shopCode, filter, startDate, endDate);
    
    res.status(200).json(metrics);
  } catch (error) {
    console.error("Finance Error:", error);
    res.status(500).json({ error: "Failed to calculate financial metrics" });
  }
};

module.exports = { fetchFinancialSummary };