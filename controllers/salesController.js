const saleModel = require('../models/salesModel');

const processBulkSale = async (req, res) => {
  try {
    const { items, paymentMethod, customerInfo } = req.body;
    
    // 🚨 UPGRADED: Securely grab the shopCode from the authenticated token
    const shopCode = req.user.shopCode;
    
    // Make sure they actually sent items
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const result = await saleModel.recordBulkSale({
      items, 
      paymentMethod, 
      customerInfo,
      shopCode // 🚨 NEW: Pass it into the model
    });

    res.status(201).json({ 
      message: "Checkout successful", 
      data: result 
    });

  } catch (error) {
    // Check if it's our custom out-of-stock error
    if (error.message.includes("Insufficient stock") || error.message.includes("Insufficient batch stock")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to process bulk checkout" });
  }
};

// todays  sales  
const getTodayStats = async(req, res)=>{
  try{
    // 🚨 UPGRADED: Grab the shopCode
    const shopCode = req.user.shopCode;

    // 🚨 NEW: Pass shopCode into the model
    const stats = await saleModel.getTodaySalesStats(shopCode);
    
    res.status(200).json({
      message: "Today's sales fetched successfully",
      data: {
        totalRevenue: parseFloat(stats.total_revenue),
        totalItemsSold: parseInt(stats.total_items_sold),
        totalProfit: parseFloat(stats.total_profit) 
      }
    });
  } catch(error) {
    console.error("dashboard sales fetch error:", error);
    res.status(500).json({error: "failed to fetch dashboard sales stat"});
  }
};


// Add this below getTodayStats
const fetchSalesHistory = async (req, res) => {
  try {
    // Extract filter parameters
    const { filter, search, startDate, endDate } = req.query;
    
    // 🚨 UPGRADED: Grab the shopCode
    const shopCode = req.user.shopCode;

    // 🚨 NEW: Pass shopCode as the very first argument
    const sales = await saleModel.getSalesHistory(shopCode, filter, search, startDate, endDate);
    
    res.status(200).json(sales);
  } catch (error) {
    console.error("Sales History Error:", error);
    res.status(500).json({ error: "Failed to fetch sales history" });
  }
};

module.exports = { 
  processBulkSale, 
  getTodayStats,
  fetchSalesHistory 
};