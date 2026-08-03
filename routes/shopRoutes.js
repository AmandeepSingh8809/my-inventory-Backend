const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');

// 🚨 Ensure createNewShop is included in this import list!
const { getMyShops, createNewShop } = require('../controllers/shopController');

router.get('/users/my-shops', verifyToken, getMyShops);
router.post('/shops/create', verifyToken, createNewShop);

module.exports = router;