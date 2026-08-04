const pool = require('../config/db');
const bcrypt = require('bcrypt');

const EmployeeModel = {
  // Fetch employees for a specific shop
  getEmployeesByShop: async (shopId) => {
    const query = `
      SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.mobile, us.role, us.is_primary
      FROM user_shops us
      JOIN users u ON us.user_id = u.id
      WHERE us.shop_id = $1;
    `;
    const result = await pool.query(query, [shopId]);
    return result.rows;
  },

  // Create user and assign to MULTIPLE shops in one transaction
  createAndAssignEmployee: async (firstName, lastName, username, email, mobile, password, role, shopIds) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Insert into users table
      const userResult = await client.query(
        `INSERT INTO users (first_name, last_name, username, email, mobile, password, user_role) 
         VALUES ($1, $2, $3, $4, $5, $6, 'staff') 
         RETURNING id, username, email`,
        [firstName, lastName, username, email, mobile, hashedPassword]
      );
      const newUser = userResult.rows[0];

      // 2. Loop through the array of specific shop IDs and grant access
      for (const shopId of shopIds) {
        await client.query(
          `INSERT INTO user_shops (user_id, shop_id, role) 
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, shop_id) DO UPDATE SET role = $3`,
          [newUser.id, shopId, role]
        );
      }

      await client.query('COMMIT');
      return newUser;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = EmployeeModel;