const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const path = require("path");
const verifyToken = require('../middleware/authMiddleware');
const { requireShopPermission, requireAnyShopPermission } = require('../middleware/authorize'); // 👈 1. Import your authorization middleware

// Configure where and how Multer saves the images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure you create a folder named 'uploads' in your backend root!
  },
  filename: (req, file, cb) => {
    // Rename the file to ensure it is unique
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


// 2. VIEW PRODUCTS: Managers, Stockists, and Salesmen all need this.
// We use requireAnyShopPermission so if they have ANY of these abilities, they can look at the inventory.
router.get(
  "/allProduct",
  verifyToken,
  requireAnyShopPermission(['manage_inventory', 'create_sale', 'view_inventory']),
  productController.fetchAllProducts
);

// 3. SEARCH PRODUCTS: Same as viewing, everyone working the shop needs to search.
router.get(
  "/search",
  verifyToken,
  requireAnyShopPermission(['manage_inventory', 'create_sale', 'view_inventory']),
  productController.searchProducts
);

// 4. ADD PRODUCTS: Strictly locked down to roles that handle stock (Managers and Stockists).
// Notice how `upload.single('image')` stays right before the controller!
router.post(
  "/addProduct",
  verifyToken,
  requireShopPermission('manage_inventory'),
  upload.single('image'),
  productController.addProduct
);

module.exports = router;