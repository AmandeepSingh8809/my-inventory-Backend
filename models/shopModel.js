const pool = require('../config/db');
const crypto = require('crypto');

const ShopModel = {
  // Fetch shops owned or assigned to a user
  getShopsByUser: async (userId) => {
    const query = `
      SELECT id, shop_code, shop_name, 'owner' AS role, true AS is_primary
      FROM shops 
      WHERE owner_id = $1
      
      UNION 
      
      SELECT s.id, s.shop_code, s.shop_name, us.role, us.is_primary
      FROM user_shops us
      JOIN shops s ON us.shop_id = s.id
      WHERE us.user_id = $1;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },

  // Create a new shop and assign the user as owner
  createShop: async (shopName, address, pincode, userId) => {
    const uniqueHash = crypto.randomBytes(3).toString('hex').toUpperCase();
    const shopCode = `SHOP_${uniqueHash}`;

    const query = `
      INSERT INTO shops (shop_code, shop_name, address, pincode, owner_id) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;
    `;
    const result = await pool.query(query, [shopCode, shopName, address, pincode, userId]);
    return result.rows[0];
  }
};

module.exports = ShopModel;