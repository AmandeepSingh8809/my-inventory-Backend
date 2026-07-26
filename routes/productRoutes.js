const express = require("express");
const  router = express.Router();
const productController = require("../controllers/productController");




router.get("/allProduct",productController.fetchAllProducts);
router.post("/addProduct",productController.addProduct);
router.get("/search", productController.searchProducts);
module.exports = router;