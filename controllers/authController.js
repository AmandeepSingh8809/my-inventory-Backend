const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  // 1. Only accept username and password from the login screen!
  const { username, password } = req.body;

  try {
    const userCheck = await pool.query('SELECT * FROM users');
    
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // 2. Auto-create the user WITH the 'Admin' role
      await pool.query(
        'INSERT INTO users (username, password, user_role) VALUES ($1, $2, $3)',
        ['admin', hashedPassword, 'Admin']
      );
      console.log("Default admin account created: admin / admin123 / Admin");
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 3. user now contains user.role from the database
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 4. Put the role inside the token for secure backend route checks later
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.user_role }, 
      process.env.JWT_SECRET || 'super_secret_inventory_key', 
      { expiresIn: '7d' }
    );

    // 5. Send the database-verified role to the frontend
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.user_role || 'Cashier' // Fallback just in case
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = { login };