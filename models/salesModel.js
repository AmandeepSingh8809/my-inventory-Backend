const pool = require("../config/db.js");
const crypto = require("crypto");

const recordBulkSale = async ({
  items,
  paymentMethod = "CASH",
  customerInfo = null,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const completedSales = [];

    // Loop through every item in the shopping cart array
    for (const item of items) {
      const { productId, quantity, unitPrice, totalAmount } = item;

      // 1. Deduct stock safely (The WHERE clause ensures it never drops below 0)
      const updateResult = await client.query(
        `UPDATE product 
         SET quantity = quantity - $2 
         WHERE id = $1 AND quantity >= $2 
         RETURNING name;`, // We return the name so we can show a helpful error if it fails
        [productId, quantity],
      );

      // If no rows come back, it means this specific item ran out of stock!
      if (updateResult.rows.length === 0) {
        throw new Error(`Insufficient stock for one of the items in the cart.`);
      }

      // 2. Record this specific item in the sale table
      const saleId = crypto.randomUUID();
      const saleResult = await client.query(
        `INSERT INTO sale (id, product_id, quantity, unit_price, total_amount, payment_method, customer_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [
          saleId,
          productId,
          quantity,
          unitPrice,
          totalAmount,
          paymentMethod,
          customerInfo,
        ],
      );

      completedSales.push(saleResult.rows[0]);
    }

    // 3. If the loop finishes without any errors, lock it all in!
    await client.query("COMMIT");

    return completedSales;
  } catch (error) {
    // If ANY item in the loop fails, undo everything
    await client.query("ROLLBACK");
    console.error("Bulk sale error:", error);
    throw error;
  } finally {
    client.release();
  }
};
// Add this below your recordBulkSale function
const getTodaySalesStats = async () => {
  const query = `
    SELECT 
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COUNT(id) AS total_items_sold
    FROM sale
    WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
  `;

  const result = await pool.query(query);

  // result.rows[0] will look like: { total_revenue: 1500, total_items_sold: 5 }
  return result.rows[0];
};



// NEW: Accept startDate and endDate
const getSalesHistory = async (filter, search, startDate, endDate) => {
  let sql = `
    SELECT 
      s.*, 
      p.name AS product_name,
      p.code AS product_code
    FROM sale s
    LEFT JOIN product p ON s.product_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramIdx = 1;

  if (filter === 'Today') {
    sql += ` AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')`;
  } else if (filter === '1 Week') {
    sql += ` AND s.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '7 days'`;
  } else if (filter === '1 Month') {
    sql += ` AND s.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 month'`;
  } else if (filter === '6 Months') {
    sql += ` AND s.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '6 months'`;
  } else if (filter === '1 Year') {
    sql += ` AND s.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 year'`;
  } 
  // NEW: Add the logic for the Custom filter
  else if (filter === 'Custom' && startDate && endDate) {
    sql += ` AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') >= $${paramIdx} 
             AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') <= $${paramIdx + 1}`;
    params.push(startDate, endDate);
    paramIdx += 2;
  }

  // KEYWORD SEARCH
  if (search) {
    const cleanSearch = search.trim();
    sql += ` AND (
      s.id::text ILIKE $${paramIdx} OR 
      s.customer_info ILIKE $${paramIdx} OR 
      p.name ILIKE $${paramIdx} OR 
      p.code::text ILIKE $${paramIdx}
    )`;
    params.push(`%${cleanSearch}%`);
    paramIdx++;
  }

  sql += ` ORDER BY s.created_at DESC LIMIT 100;`;

  const result = await pool.query(sql, params);
  
  return result.rows.map(row => {
    if (row.customer_info) {
      try { row.customer_info = JSON.parse(row.customer_info); } catch (e) {}
    }
    return row;
  });
};


module.exports = { 
  recordBulkSale, 
  getTodaySalesStats,
  getSalesHistory 
};