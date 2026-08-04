const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { getShopEmployees, createEmployee } = require('../controllers/employeeController');

router.get('/employees', verifyToken, getShopEmployees);
router.post('/employees/create', verifyToken, createEmployee);

module.exports = router;