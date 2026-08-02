const purchaseModel = require('../models/purchaseModel');

const fetchPurchases = async (req, res) => {
  try {
    const { filter, search, startDate, endDate } = req.query;
    
    // 🚨 UPGRADED: Securely grab the shopCode from the authenticated token
    const shopCode = req.user.shopCode;

    // 🚨 UPGRADED: Pass the shopCode as the very first parameter to your model
    const purchases = await purchaseModel.getPurchaseHistory(shopCode, filter, search, startDate, endDate);
    
    res.status(200).json(purchases);
  } catch (error) {
    console.error("Purchase History Error:", error);
    res.status(500).json({ error: "Failed to fetch stock-in history" });
  }
};

module.exports = { fetchPurchases };