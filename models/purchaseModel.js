const pool = require("../config/db.js");

const getPurchaseHistory = async (filter, search, startDate, endDate) => {
  // Join product so we know WHAT was purchased
  let sql = `
    SELECT 
      pr.*, 
      p.name AS product_name,
      p.code AS product_code
    FROM purchase pr
    LEFT JOIN product p ON pr.product_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramIdx = 1;

  // 1. DATE FILTERS (Assuming your timestamp column is 'created_at')
  if (filter === 'Today') {
    sql += ` AND DATE(pr.created_at AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')`;
  } else if (filter === '1 Week') {
    sql += ` AND pr.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '7 days'`;
  } else if (filter === '1 Month') {
    sql += ` AND pr.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 month'`;
  } else if (filter === '6 Months') {
    sql += ` AND pr.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '6 months'`;
  } else if (filter === '1 Year') {
    sql += ` AND pr.created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' - INTERVAL '1 year'`;
  } else if (filter === 'Custom' && startDate && endDate) {
    sql += ` AND DATE(pr.created_at AT TIME ZONE 'Asia/Kolkata') >= $${paramIdx} 
             AND DATE(pr.created_at AT TIME ZONE 'Asia/Kolkata') <= $${paramIdx + 1}`;
    params.push(startDate, endDate);
    paramIdx += 2;
  }

  // 2. KEYWORD SEARCH
  if (search) {
    const cleanSearch = search.trim();
    sql += ` AND (
      pr.supplier ILIKE $${paramIdx} OR 
      p.name ILIKE $${paramIdx} OR 
      p.code::text ILIKE $${paramIdx}
    )`;
    params.push(`%${cleanSearch}%`);
    paramIdx++;
  }

  // Sort newest first
  sql += ` ORDER BY pr.created_at DESC LIMIT 100;`;

  const result = await pool.query(sql, params);
  return result.rows;
};

module.exports = { getPurchaseHistory };