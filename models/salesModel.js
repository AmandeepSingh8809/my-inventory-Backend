const pool = require("../config/db.js");
const crypto = require("crypto");

// 🚨 UPGRADED: Added userId to the destructured parameters
const recordBulkSale = async ({
  items,
  paymentMethod = "CASH",
  customerInfo = null,
  shopCode,
  userId // 🔥 NEW: Capture the user making the sale
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const completedSales = [];

    // Loop through every item in the shopping cart array
    for (const item of items) {
      const { productId, quantity, unitPrice, totalAmount } = item;
      
      let qtyToDeduct = parseFloat(quantity);
      let totalFifoCostForThisItem = 0;

      // 1. THE FIFO ENGINE
      const batchesResult = await client.query(
        `SELECT id, remaining_qty, unit_cost 
         FROM purchase 
         WHERE product_id = $1 AND remaining_qty > 0 AND shop_code = $2 
         ORDER BY created_at ASC, id ASC 
         FOR UPDATE`,
        [productId, shopCode]
      );

      for (const batch of batchesResult.rows) {
        if (qtyToDeduct <= 0) break;

        const availableInBatch = parseFloat(batch.remaining_qty);
        const costOfBatchItem = parseFloat(batch.unit_cost);
        const deductQty = Math.min(qtyToDeduct, availableInBatch);

        totalFifoCostForThisItem += (deductQty * costOfBatchItem);

        await client.query(
          `UPDATE purchase SET remaining_qty = remaining_qty - $1 WHERE id = $2`,
          [deductQty, batch.id]
        );

        qtyToDeduct -= deductQty;
      }

      if (qtyToDeduct > 0) {
        throw new Error(`Insufficient batch stock (FIFO) for one of the items. Did you sell more than you purchased?`);
      }

      // 2. Deduct stock safely from the main product table
      const updateResult = await client.query(
        `UPDATE product 
         SET quantity = quantity - $2 
         WHERE id = $1 AND quantity >= $2 AND shop_code = $3 
         RETURNING name;`, 
        [productId, quantity, shopCode],
      );

      if (updateResult.rows.length === 0) {
        throw new Error(`Insufficient total stock for one of the items in the cart.`);
      }

      // 3. Record this specific item in the sale table
      const saleId = crypto.randomUUID();
      const saleResult = await client.query(
        // 🔥 NEW: Added user_id to the INSERT query and $10 to VALUES
        `INSERT INTO sale (id, product_id, quantity, unit_price, total_amount, payment_method, customer_info, total_cost, shop_code, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING *;`,
        [
          saleId,
          productId,
          quantity,
          unitPrice,
          totalAmount,
          paymentMethod,
          customerInfo,
          totalFifoCostForThisItem,
          shopCode,
          userId // 🔥 NEW: Save the salesman's ID
        ],
      );

      completedSales.push(saleResult.rows[0]);
    }

    await client.query("COMMIT");
    return completedSales;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk sale error:", error);
    throw error;
  } finally {
    client.release();
  }
};


// 🚨 UPGRADED: Added scopeToUserId parameter
const getTodaySalesStats = async (shopCode, scopeToUserId) => {
  let query = `
    SELECT 
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(SUM(total_cost), 0) AS total_cost,
      COALESCE(SUM(total_amount) - SUM(total_cost), 0) AS total_profit,
      COUNT(id) AS total_items_sold
    FROM sale
    WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
      AND shop_code = $1
  `;
  
  const params = [shopCode];

  // 🔥 SCOPING MAGIC: If this is a Salesman, lock it to their ID
  if (scopeToUserId) {
    params.push(scopeToUserId); // Pushes to index 1 (which becomes $2)
    query += ` AND user_id = $2`;
  }

  const result = await pool.query(query, params);
  return result.rows[0]; 
};


// 🚨 UPGRADED: Added scopeToUserId parameter
const getSalesHistory = async (shopCode, filter, search, startDate, endDate, scopeToUserId) => {
  let sql = `
    SELECT 
      s.*, 
      p.name AS product_name,
      p.code AS product_code
    FROM sale s
    LEFT JOIN product p ON s.product_id = p.id
    WHERE s.shop_code = $1
  `;
  
  const params = [shopCode];
  let paramIdx = 2; 

  // 🔥 SCOPING MAGIC: Restrict to specific user if requested
  if (scopeToUserId) {
    sql += ` AND s.user_id = $${paramIdx}`;
    params.push(scopeToUserId);
    paramIdx++; // Automatically bumps the index for the next filters!
  }

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