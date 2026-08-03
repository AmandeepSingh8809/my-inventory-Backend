const pool = require("../config/db.js");

const getFinancialMetrics = async (shopCode, filter = 'All Time', startDate, endDate) => {
  // ---------------------------------------------------------
  // QUERY 1: THE SNAPSHOT (Current Asset Valuation)
  // ---------------------------------------------------------
  const stockQuery = `
    SELECT COALESCE(SUM(remaining_qty * unit_cost), 0) AS total_stock_value 
    FROM purchase 
    WHERE remaining_qty > 0 AND shop_code = $1; 
  `;

  // ---------------------------------------------------------
  // TIMELINE CONDITION BUILDER
  // ---------------------------------------------------------
  let timeCondition = '';
  
  const params = [shopCode];
  let paramIdx = 2; 

  if (filter === 'Today') {
    timeCondition = ` AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')`;
  } else if (filter === '1 Week') {
    timeCondition = ` AND created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '7 days'`;
  } else if (filter === '1 Month') {
    timeCondition = ` AND created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 month'`;
  } else if (filter === '6 Months') {
    timeCondition = ` AND created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '6 months'`;
  } else if (filter === '1 Year') {
    timeCondition = ` AND created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 year'`;
  } else if (filter === 'Custom' && startDate && endDate) {
    timeCondition = ` AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') >= $${paramIdx} AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') <= $${paramIdx + 1}`;
    params.push(startDate, endDate);
  }

  // ---------------------------------------------------------
  // QUERY 2: SALES, COGS, & GROSS PROFIT (Income Statement)
  // ---------------------------------------------------------
  const salesQuery = `
    SELECT 
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(SUM(total_cost), 0) AS total_cogs
    FROM sale 
    WHERE shop_code = $1 ${timeCondition}; 
  `;

  // ---------------------------------------------------------
  // QUERY 3: CASH OUT (Purchases / Restocks)
  // ---------------------------------------------------------
  const purchaseQuery = `
    SELECT COALESCE(SUM(total_cost), 0) AS total_purchases
    FROM purchase
    WHERE shop_code = $1 ${timeCondition}; 
  `;

  // ---------------------------------------------------------
  // EXECUTE ALL QUERIES SIMULTANEOUSLY FOR SPEED
  // ---------------------------------------------------------
  try {
    // 🚨 FIX: Removed client.connect(). We now let the pool handle everything automatically!
    const [stockRes, salesRes, purchaseRes] = await Promise.all([
      pool.query(stockQuery, [shopCode]), 
      pool.query(salesQuery, params),
      pool.query(purchaseQuery, params)
    ]);

    // Parse data safely
    const totalStockValue = parseFloat(stockRes.rows[0].total_stock_value);
    const totalRevenue = parseFloat(salesRes.rows[0].total_revenue);
    const totalCOGS = parseFloat(salesRes.rows[0].total_cogs);
    const totalPurchases = parseFloat(purchaseRes.rows[0].total_purchases);
    
    // Business Math calculations
    const grossProfit = totalRevenue - totalCOGS;
    const grossMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;
    const netCashFlow = totalRevenue - totalPurchases;

    return {
      snapshot: {
        totalStockValue
      },
      timeline: {
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMarginPercent: parseFloat(grossMarginPercent),
        totalPurchases,
        netCashFlow
      }
    };
  } catch (error) {
    // Added a catch block so if it ever fails, it tells us why!
    console.error("Finance Model Error:", error);
    throw error;
  }
};

module.exports = { getFinancialMetrics };