const pool = require("../config/db.js");

const getFinancialMetrics = async (filter = 'All Time', startDate, endDate) => {
  // ---------------------------------------------------------
  // QUERY 1: THE SNAPSHOT (Current Asset Valuation)
  // This ignores time filters because stock value is "right now"
  // ---------------------------------------------------------
  const stockQuery = `
    SELECT COALESCE(SUM(quantity * "costPrice"), 0) AS total_stock_value 
    FROM product 
    WHERE quantity > 0;
  `;

  // ---------------------------------------------------------
  // TIMELINE CONDITION BUILDER
  // ---------------------------------------------------------
  let timeCondition = '';
  const params = [];
  let paramIdx = 1;

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
    timeCondition = ` AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') >= $1 AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') <= $2`;
    params.push(startDate, endDate);
  }

  // ---------------------------------------------------------
  // QUERY 2: SALES, COGS, & GROSS PROFIT (Income Statement)
  // ---------------------------------------------------------
  // We join the product table to fetch the costPrice of the sold items
  const salesQuery = `
    SELECT 
      COALESCE(SUM(s.total_amount), 0) AS total_revenue,
      COALESCE(SUM(s.quantity * p."costPrice"), 0) AS total_cogs
    FROM sale s
    LEFT JOIN product p ON s.product_id = p.id
    WHERE 1=1 ${timeCondition.replace(/created_at/g, 's.created_at')};
  `;

  // ---------------------------------------------------------
  // QUERY 3: CASH OUT (Purchases / Restocks)
  // ---------------------------------------------------------
  const purchaseQuery = `
    SELECT COALESCE(SUM(total_cost), 0) AS total_purchases
    FROM purchase
    WHERE 1=1 ${timeCondition};
  `;

  // ---------------------------------------------------------
  // EXECUTE ALL QUERIES SIMULTANEOUSLY FOR SPEED
  // ---------------------------------------------------------
  const client = await pool.connect();
  try {
    const [stockRes, salesRes, purchaseRes] = await Promise.all([
      client.query(stockQuery),
      client.query(salesQuery, params),
      client.query(purchaseQuery, params)
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
  } finally {
    client.release();
  }
};

module.exports = { getFinancialMetrics };