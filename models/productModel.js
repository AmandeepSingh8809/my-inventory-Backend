const pool = require("../config/db.js");
const crypto = require("crypto"); // Built-in Node.js module to generate IDs

// 🚨 UPGRADED: Added `shopCode` parameter and `WHERE p.shop_code = $1`
const fetchAllProduct = async (shopCode, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT 
        p.*, 
        u.name AS unit_name 
     FROM product p
     LEFT JOIN unit u ON p.unit_id = u.id
     WHERE p.shop_code = $1
     ORDER BY p.id DESC 
     LIMIT $2 OFFSET $3;`,
    [shopCode, limit, offset]
  );
  return result.rows;  
};

const searchProducts = async (filters) => {
  // 🚨 UPGRADED: Extract shopCode from filters
  const { query, category, minPrice, maxPrice, inStockOnly, shopCode } = filters;
  const cleanQuery = query ? query.trim() : '';
  
  // 🚨 UPGRADED: Added `WHERE p.shop_code = $2` to lock search to their shop
  let sql = `
    SELECT p.*, u.name AS unit_name,
           CASE WHEN p.carton_code = $1 THEN p.carton_multiplier ELSE 1 END AS scan_qty,
           ps.serial_number AS scanned_serial 
    FROM product p
    LEFT JOIN unit u ON p.unit_id = u.id
    LEFT JOIN product_serial ps ON ps.product_id = p.id AND ps.serial_number = $1
    WHERE p.shop_code = $2
  `;

  // $1 is cleanQuery, $2 is shopCode
  const params = [cleanQuery, shopCode];
  let paramIdx = 3; 

  if (cleanQuery) {
    sql += ` AND (
      p.code::text ILIKE $${paramIdx} OR 
      p.carton_code::text ILIKE $${paramIdx} OR 
      ps.serial_number::text ILIKE $${paramIdx} OR 
      p.name ILIKE $${paramIdx}
    )`;
    params.push(`%${cleanQuery}%`);
    paramIdx += 1;
  }

  if (category && category !== 'All') {
    sql += ` AND p.category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }

  if (minPrice) {
    sql += ` AND p.price >= $${paramIdx}`;
    params.push(Number(minPrice));
    paramIdx++;
  }

  if (maxPrice) {
    sql += ` AND p.price <= $${paramIdx}`;
    params.push(Number(maxPrice));
    paramIdx++;
  }

  if (inStockOnly === 'true') {
    sql += ` AND p.quantity > 0`;
  }

  sql += ` ORDER BY p.name ASC LIMIT 50;`;

  const result = await pool.query(sql, params);
  return result.rows;
};

const addProduct = async ({ 
  code, name, price, costPrice, quantity, unit_id, 
  supplier = 'Walk-in / Unknown', invoiceNumber = null,
  cartonCode = null, cartonMultiplier = 1,
  serials = [],
  image_url = null,
  shop_code // 🚨 UPGRADED: Must receive the shop_code from the controller
}) => {
  const client = await pool.connect();

  const cleanCartonCode = cartonCode && cartonCode.trim() !== '' ? cartonCode.trim() : null;
  const cleanMultiplier = cartonMultiplier ? parseInt(cartonMultiplier) : 1;

  try {
    await client.query('BEGIN');
    let currentProduct;

    // 🚨 UPGRADED: Check if product exists IN THIS SPECIFIC SHOP
    const checkResult = await client.query(
      `SELECT * FROM product 
       WHERE (code = $1 OR (carton_code = $2 AND carton_code IS NOT NULL)) 
       AND shop_code = $3`, 
      [code, cleanCartonCode, shop_code]
    );

    if (checkResult.rows.length > 0) {
      // 🟢 EXISTING PRODUCT (Restock)
      currentProduct = checkResult.rows[0];
      const updateResult = await client.query(
        `UPDATE product 
         SET quantity = quantity + $1, 
             price = $2, 
             "costPrice" = $3,
             carton_code = COALESCE($4, carton_code),
             carton_multiplier = COALESCE($5, carton_multiplier),
             image_url = COALESCE($6, image_url)
         WHERE id = $7 RETURNING *;`,
        [quantity, price, costPrice, cleanCartonCode, cleanMultiplier, image_url, currentProduct.id]
      );
      currentProduct = updateResult.rows[0];
    } else {
      // 🔵 NEW PRODUCT
      const newProductId = crypto.randomUUID();
      const insertResult = await client.query(
        // 🚨 UPGRADED: Insert the shop_code ($11) into the database
        `INSERT INTO product (id, code, name, price, "costPrice", quantity, unit_id, carton_code, carton_multiplier, image_url, shop_code) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`,
        [newProductId, code, name, price, costPrice, quantity, unit_id, cleanCartonCode, cleanMultiplier, image_url, shop_code]
      );
      currentProduct = insertResult.rows[0];
    }

    if (serials && Array.isArray(serials) && serials.length > 0) {
      for (const serial of serials) {
        if (serial && serial.trim() !== '') {
          await client.query(
            `INSERT INTO product_serial (product_id, serial_number, status) 
             VALUES ($1, $2, 'IN_STOCK') 
             ON CONFLICT (serial_number) DO NOTHING;`,
            [currentProduct.id, serial.trim()]
          );
        }
      }
    }

    if (quantity > 0) {
      const totalCost = quantity * costPrice;
      await client.query(
        `INSERT INTO purchase (product_id, quantity, remaining_qty, unit_cost, total_cost, supplier, invoice_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [currentProduct.id, quantity, quantity, costPrice, totalCost, supplier, invoiceNumber]
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