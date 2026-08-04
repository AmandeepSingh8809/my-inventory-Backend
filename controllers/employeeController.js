const pool = require('../config/db');
const EmployeeModel = require('../models/employeeModel');

const getShopEmployees = async (req, res) => {
  try {
    const shopCode = req.headers['x-shop-code'];
    if (!shopCode) return res.status(400).json({ error: "No active shop selected" });

    const shopResult = await pool.query('SELECT id FROM shops WHERE shop_code = $1', [shopCode]);
    if (shopResult.rows.length === 0) return res.status(404).json({ error: "Shop not found" });

    const employees = await EmployeeModel.getEmployeesByShop(shopResult.rows[0].id);
    res.status(200).json(employees);
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({ error: "Server error fetching employees" });
  }
};

// Create employee and assign to an ARRAY of shops
const createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, username, email, mobile, password, role, shopCodes } = req.body;
    
    // Fallback to the active shop header if they don't explicitly pass an array of codes
    const activeShopCode = req.headers['x-shop-code']; 
    const targetCodes = (shopCodes && shopCodes.length > 0) ? shopCodes : [activeShopCode];

    if (!firstName || !username || !email || !password || !role || !targetCodes[0]) {
      return res.status(400).json({ error: "Please fill out all required fields and select at least one shop." });
    }

    // 1. Convert all selected shop codes into real database shop IDs
    const shopIds = [];
    for (const code of targetCodes) {
      const shopResult = await pool.query('SELECT id FROM shops WHERE shop_code = $1', [code]);
      if (shopResult.rows.length > 0) {
        shopIds.push(shopResult.rows[0].id);
      }
    }

    if (shopIds.length === 0) {
      return res.status(404).json({ error: "None of the provided shops were found in the database." });
    }

    // 2. Create the user and assign them to ONLY those 3 out of 5 shops
    const newEmployee = await EmployeeModel.createAndAssignEmployee(
      firstName, lastName, username.trim().toLowerCase(), email.trim().toLowerCase(), 
      mobile, password, role, shopIds
    );

    res.status(201).json({
      message: `Employee ${newEmployee.username} created and assigned to ${shopIds.length} shop(s) successfully!`,
      employee: newEmployee
    });
  } catch (error) {
    console.error("Create employee error:", error);
    if (error.code === '23505') {
      return res.status(400).json({ error: "Username or email is already taken." });
    }
    res.status(500).json({ error: "Server error while creating employee" });
  }
};

module.exports = {
  getShopEmployees,
  createEmployee
};