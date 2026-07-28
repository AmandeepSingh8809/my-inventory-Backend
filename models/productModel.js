const pool = require("../config/db.js");
const crypto = require("crypto"); // Built-in Node.js module to generate IDs

const fetchAllProduct = async (limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT 
        p.*, 
        u.name AS unit_name 
     FROM product p
     LEFT JOIN unit u ON p.unit_id = u.id
     ORDER BY p.id DESC 
     LIMIT $1 OFFSET $2;`,
    [limit, offset]
  );
  return result.rows;  
}
const searchProducts = async (filters) => {
  const { query, category, minPrice, maxPrice, inStockOnly } = filters;
  
  // Start with a base query
  let sql = `
    SELECT p.*, u.name AS unit_name 
    FROM product p
    LEFT JOIN unit u ON p.unit_id = u.id
    WHERE 1=1
  `; // 'WHERE 1=1' is a SQL trick that makes appending 'AND' clauses easier

  const params = [];
  let paramIdx = 1;

  // 1. Text Search (Barcode or Name)
  // 1. Text Search (Barcode or Name)
  if (query) {
    // .trim() removes any hidden 'Enter' keystrokes added by the scanner
    const cleanQuery = query.trim(); 
    
    // We cast code to ::text safely, and use ILIKE for both code and name
    sql += ` AND (p.code::text ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`;
    
    // Use the same wildcard parameter for both columns!
    params.push(`%${cleanQuery}%`);
    paramIdx += 1;
  }

  // 2. Category Filter
  if (category && category !== 'All') {
    sql += ` AND p.category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }

  // 3. Minimum Price
  if (minPrice) {
    sql += ` AND p.price >= $${paramIdx}`;
    params.push(Number(minPrice));
    paramIdx++;
  }

  // 4. Maximum Price
  if (maxPrice) {
    sql += ` AND p.price <= $${paramIdx}`;
    params.push(Number(maxPrice));
    paramIdx++;
  }

  // 5. In-Stock Only Toggle
  if (inStockOnly === 'true') {
    sql += ` AND p.quantity > 0`;
  }

  // Sort alphabetically and cap it to prevent crashing the mobile app
  sql += ` ORDER BY p.name ASC LIMIT 50;`;

  const result = await pool.query(sql, params);
  return result.rows;
};



// Add supplier and invoiceNumber as optional parameters
const addProduct = async ({ code, name, price, costPrice, quantity, unit_id, supplier = 'Walk-in / Unknown', invoiceNumber = null }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let currentProduct;

    const checkResult = await client.query('SELECT * FROM product WHERE code = $1', [code]);

    if (checkResult.rows.length > 0) {
      // 🟢 EXISTING PRODUCT
      currentProduct = checkResult.rows[0];
      const updateResult = await client.query(
        `UPDATE product SET quantity = quantity + $1, price = $2, "costPrice" = $3 WHERE id = $4 RETURNING *;`,
        [quantity, price, costPrice, currentProduct.id]
      );
      currentProduct = updateResult.rows[0];
    } else {
      // 🔵 NEW PRODUCT
      const newProductId = crypto.randomUUID();
      const insertResult = await client.query(
        `INSERT INTO product (id, code, name, price, "costPrice", quantity, unit_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
        [newProductId, code, name, price, costPrice, quantity, unit_id]
      );
      currentProduct = insertResult.rows[0];
    }

    // 3. Log the "Stock In" activity WITH the new supplier and invoice fields!
    if (quantity > 0) {
      const totalCost = quantity * costPrice;
      await client.query(
        `INSERT INTO purchase (product_id, quantity, unit_cost, total_cost, supplier, invoice_number)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [currentProduct.id, quantity, costPrice, totalCost, supplier, invoiceNumber] // <-- Added here
      );
    }

    await client.query('COMMIT');
    return currentProduct;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  fetchAllProduct,
  addProduct,
  searchProducts,
};