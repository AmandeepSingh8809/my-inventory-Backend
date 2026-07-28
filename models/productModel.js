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
};

const searchProducts = async (filters) => {
  const { query, category, minPrice, maxPrice, inStockOnly } = filters;
  const cleanQuery = query ? query.trim() : '';
  
  // Start with a base query
  // NEW: We pass $1 as the exact scanned code. If it matches the carton_code, scan_qty becomes the multiplier!
  let sql = `
    SELECT p.*, u.name AS unit_name,
           CASE WHEN p.carton_code = $1 THEN p.carton_multiplier ELSE 1 END AS scan_qty
    FROM product p
    LEFT JOIN unit u ON p.unit_id = u.id
    WHERE 1=1
  `;

  // $1 is always the cleanQuery for the CASE statement above
  const params = [cleanQuery];
  let paramIdx = 2; 

  // 1. Text Search (Item Barcode, Carton Barcode, or Name)
  if (cleanQuery) {
    sql += ` AND (p.code::text ILIKE $${paramIdx} OR p.carton_code::text ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`;
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

// NEW: Added cartonCode and cartonMultiplier to the function parameters
const addProduct = async ({ 
  code, name, price, costPrice, quantity, unit_id, 
  supplier = 'Walk-in / Unknown', invoiceNumber = null,
  cartonCode = null, cartonMultiplier = 1 
}) => {
  const client = await pool.connect();

  // Protect against empty strings from the frontend breaking the UNIQUE constraint
  const cleanCartonCode = cartonCode && cartonCode.trim() !== '' ? cartonCode.trim() : null;
  const cleanMultiplier = cartonMultiplier ? parseInt(cartonMultiplier) : 1;

  try {
    await client.query('BEGIN');
    let currentProduct;

    // Check if it exists by normal code OR carton code
    const checkResult = await client.query(
      'SELECT * FROM product WHERE code = $1 OR (carton_code = $2 AND carton_code IS NOT NULL)', 
      [code, cleanCartonCode]
    );

    if (checkResult.rows.length > 0) {
      // 🟢 EXISTING PRODUCT
      currentProduct = checkResult.rows[0];
      const updateResult = await client.query(
        `UPDATE product 
         SET quantity = quantity + $1, 
             price = $2, 
             "costPrice" = $3,
             carton_code = COALESCE($4, carton_code),
             carton_multiplier = COALESCE($5, carton_multiplier)
         WHERE id = $6 RETURNING *;`,
        [quantity, price, costPrice, cleanCartonCode, cleanMultiplier, currentProduct.id]
      );
      currentProduct = updateResult.rows[0];
    } else {
      // 🔵 NEW PRODUCT
      const newProductId = crypto.randomUUID();
      const insertResult = await client.query(
        `INSERT INTO product (id, code, name, price, "costPrice", quantity, unit_id, carton_code, carton_multiplier) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`,
        [newProductId, code, name, price, costPrice, quantity, unit_id, cleanCartonCode, cleanMultiplier]
      );
      currentProduct = insertResult.rows[0];
    }

    // 3. Log the "Stock In" activity WITH the supplier and invoice fields
    if (quantity > 0) {
      const totalCost = quantity * costPrice;
      await client.query(
        `INSERT INTO purchase (product_id, quantity, unit_cost, total_cost, supplier, invoice_number)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [currentProduct.id, quantity, costPrice, totalCost, supplier, invoiceNumber]
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