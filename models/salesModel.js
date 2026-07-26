const pool = require("../config/db.js");
const crypto = require("crypto");

const recordSale = async ({ productId, quantity, unitPrice, totalAmount, paymentMethod = 'CASH', customerInfo = null }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Deduct stock safely (The WHERE clause ensures we don't drop below 0)
    const updateResult = await client.query(
      `UPDATE product 
       SET quantity = quantity - $2 
       WHERE id = $1 AND quantity >= $2 
       RETURNING *;`,
      [productId, quantity]
    );

    // If no rows come back, it means they didn't have enough stock!
    if (updateResult.rows.length === 0) {
      throw new Error("Insufficient stock");
    }

    const updatedProduct = updateResult.rows[0];

    // 2. Record the transaction in the sale table
    const saleId = crypto.randomUUID();
    
    const saleResult = await client.query(
      `INSERT INTO sale (id, product_id, quantity, unit_price, total_amount, payment_method, customer_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [saleId, productId, quantity, unitPrice, totalAmount, paymentMethod, customerInfo]
    );

    await client.query('COMMIT');
    
    // Return both the sale details and the new stock level to the frontend
    return {
      sale: saleResult.rows[0],
      remainingStock: updatedProduct.quantity
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error recording sale:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  recordSale
};