const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireShopPermission } = require('../middleware/authorize'); 
const { getShopEmployees, createEmployee } = require('../controllers/employeeController');

// 2. Lock down the GET route
router.get(
  '/employees', 
  verifyToken, 
  requireShopPermission('manage_employees'), 
  getShopEmployees
);

// 3. Lock down the POST route
router.post(
  '/employees/create', 
  verifyToken, 
  requireShopPermission('manage_employees'), 
  createEmployee
);

module.exports = router;