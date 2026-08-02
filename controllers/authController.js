const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const login = async (req, res) => {
  // 1. Only accept username and password from the login screen!
  const { username, password } = req.body;

  try {
    const userCheck = await pool.query('SELECT * FROM users');
    
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // 2. Auto-create the user WITH the 'Admin' role AND a default 'HQ_001' shop_code
      await pool.query(
        'INSERT INTO users (username, password, user_role, shop_code) VALUES ($1, $2, $3, $4)',
        ['admin', hashedPassword, 'Admin', 'HQ_001']
      );
      console.log("Default admin account created: admin / admin123 / Admin / HQ_001");
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 3. user now contains user_role and shop_code from the database
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // 4. Put the role and shop_code inside the token for secure backend route checks later
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.user_role,
        shopCode: user.shop_code 
      }, 
      process.env.JWT_SECRET || 'super_secret_inventory_key', 
      { expiresIn: '7d' }
    );

    // 5. Send the database-verified role and shop_code to the frontend
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.user_role || 'Cashier', // Fallback just in case
        shopCode: user.shop_code || 'HQ_001'
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Server error during login' });
  }
};



//register  logic 
const  register = async(req, res)=>{
  const{
    firstName,lastName,username,email,mobile,shopName,address,pincode,password
  } = req.body;
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
  const  userCheck = await client.query(
    'SELECT * FROM users WHERE username = $1 OR email= $2',
    [username,email]
  );
  if(userCheck.rows.length>0){
    await client.query('ROLLBACK');
    return res.status(400).json({error:'Username or email already taken'});
  }
  const uniqueHash = crypto.randomBytes(3).toString('hex').toLocaleUpperCase();
  const shopCode = `SHOP_${uniqueHash}`;

  const hashedPassword = await bcrypt.hash(password,10);
  const insertUserResult = await client.query(
    `INSERT INTO users 
        (first_name, last_name, username, email, mobile, password, user_role, shop_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, username`,
      [firstName, lastName, username, email, mobile, hashedPassword, 'admin', shopCode]
  );
  const  newUser = insertUserResult.rows[0];
  await client.query(`INSERT INTO shops (shop_code, shop_name, address, pincode, owner_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [shopCode, shopName, address, pincode, newUser.id]
    );
    await client.query('COMMIT');
    res.status(201).json({
      message: 'Store created successfully! You can now log in.',
      shopCode: shopCode
    });
  }catch(error){
    console.error("registration error",error);
    res.status(500).json({error:'server error during registration'});
  }finally{
    client.release();
  }
};
module.exports = { login,register};