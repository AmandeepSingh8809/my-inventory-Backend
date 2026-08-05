const saleModel = require('../models/salesModel');

const processBulkSale = async (req, res) => {
  try {
    const { items, paymentMethod, customerInfo } = req.body;
    
    // 🚨 UPGRADED: Grab shopCode and userId from the authenticated token
    const shopCode = req.user?.shopCode;
    const userId = req.user?.id || req.user?.userId; // Ensure we get the ID safely
    
    // Make sure they actually sent items
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const result = await saleModel.recordBulkSale({
      items, 
      paymentMethod, 
      customerInfo,
      shopCode,
      userId // 🔥 NEW: Save WHO made this sale so we can filter history later!
    });

    res.status(201).json({ 
      message: "Checkout successful", 
      data: result 
    });

  } catch (error) {
    if (error.message.includes("Insufficient stock") || error.message.includes("Insufficient batch stock")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to process bulk checkout" });
  }
};

// todays  sales  
const getTodayStats = async(req, res)=>{
  try{
    const shopCode = req.user?.shopCode;
    const userId = req.user?.id || req.user?.userId;

    // 🔥 SCOPING MAGIC: If this is a Salesman, lock the query to their ID
    const scopeToUserId = req.shopRole === 'Salesman' ? userId : null;

    // 🚨 NEW: Pass scopeToUserId into the model
    const stats = await saleModel.getTodaySalesStats(shopCode, scopeToUserId);
    
    res.status(200).json({
      message: "Today's sales fetched successfully",
      data: {
        totalRevenue: parseFloat(stats.total_revenue || 0),
        totalItemsSold: parseInt(stats.total_items_sold || 0),
        totalProfit: parseFloat(stats.total_profit || 0) 
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
    const { filter, search, startDate, endDate } = req.query;
    
    const shopCode = req.user?.shopCode;
    const userId = req.user?.id || req.user?.userId;

    // 🔥 SCOPING MAGIC: If this is a Salesman, lock the query to their ID
    const scopeToUserId = req.shopRole === 'Salesman' ? userId : null;

    // 🚨 NEW: Pass scopeToUserId as the final argument
    const sales = await saleModel.getSalesHistory(shopCode, filter, search, startDate, endDate, scopeToUserId);
    
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