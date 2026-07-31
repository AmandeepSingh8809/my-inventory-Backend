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
      
      // FIFO variables
      let qtyToDeduct = parseFloat(quantity);
      let totalFifoCostForThisItem = 0;

      // 🚨 1. THE FIFO ENGINE (Deducting from batches)
      const batchesResult = await client.query(
        `SELECT id, remaining_qty, unit_cost 
         FROM purchase 
         WHERE product_id = $1 AND remaining_qty > 0 
         ORDER BY created_at ASC, id ASC 
         FOR UPDATE`,
        [productId]
      );

      for (const batch of batchesResult.rows) {
        if (qtyToDeduct <= 0) break; // We met the required quantity

        const availableInBatch = parseFloat(batch.remaining_qty);
        const costOfBatchItem = parseFloat(batch.unit_cost);

        // Take what we need, or whatever is left in this batch
        const deductQty = Math.min(qtyToDeduct, availableInBatch);

        // Accumulate the exact FIFO cost
        totalFifoCostForThisItem += (deductQty * costOfBatchItem);

        // Deduct from this specific batch
        await client.query(
          `UPDATE purchase SET remaining_qty = remaining_qty - $1 WHERE id = $2`,
          [deductQty, batch.id]
        );

        qtyToDeduct -= deductQty;
      }

      // Safety Check: If purchase batches ran out before we met the quantity
      if (qtyToDeduct > 0) {
        throw new Error(`Insufficient batch stock (FIFO) for one of the items. Did you sell more than you purchased?`);
      }

      // 2. Deduct stock safely from the main product table
      const updateResult = await client.query(
        `UPDATE product 
         SET quantity = quantity - $2 
         WHERE id = $1 AND quantity >= $2 
         RETURNING name;`, 
        [productId, quantity],
      );

      if (updateResult.rows.length === 0) {
        throw new Error(`Insufficient total stock for one of the items in the cart.`);
      }

      // 3. Record this specific item in the sale table (Now includes total_cost!)
      const saleId = crypto.randomUUID();
      const saleResult = await client.query(
        `INSERT INTO sale (id, product_id, quantity, unit_price, total_amount, payment_method, customer_info, total_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *;`,
        [
          saleId,
          productId,
          quantity,
          unitPrice,
          totalAmount,
          paymentMethod,
          customerInfo,
          totalFifoCostForThisItem // 👈 Exact profit tracking inserted here
        ],
      );

      completedSales.push(saleResult.rows[0]);
    }

    // 4. If the loop finishes without any errors, lock it all in!
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

// 🚨 UPGRADED: Now calculates exact FIFO profit!
const getTodaySalesStats = async () => {
  const query = `
    SELECT 
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      COALESCE(SUM(total_cost), 0) AS total_cost,
      COALESCE(SUM(total_amount) - SUM(total_cost), 0) AS total_profit,
      COUNT(id) AS total_items_sold
    FROM sale
    WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata');
  `;

  const result = await pool.query(query);

  // result.rows[0] will look like: { total_revenue: 6000, total_cost: 3300, total_profit: 2700, total_items_sold: 1 }
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