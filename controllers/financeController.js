const financeModel = require('../models/financeModel');

const fetchFinancialSummary = async (req, res) => {
  try {
    // Extract filters from the request query string (e.g., ?filter=1 Month)
    const { filter, startDate, endDate } = req.query;

    const metrics = await financeModel.getFinancialMetrics(filter, startDate, endDate);
    
    res.status(200).json(metrics);
  } catch (error) {
    console.error("Finance Error:", error);
    res.status(500).json({ error: "Failed to calculate financial metrics" });
  }
};

module.exports = { fetchFinancialSummary };