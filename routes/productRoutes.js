const express = require("express");
const  router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const path = require("path");
const  verifyToken = require('../middleware/authMiddleware');

// 🚨 NEW: Configure where and how Multer saves the images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure you create a folder named 'uploads' in your backend root!
  },
  filename: (req, file, cb) => {
    // Rename the file to ensure it is unique (e.g., 16900012345-image.jpg)
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });


router.get("/allProduct",verifyToken,productController.fetchAllProducts);
router.post("/addProduct",verifyToken,upload.single('image'),productController.addProduct);
router.get("/search",verifyToken, productController.searchProducts);
module.exports = router;