// Import the model you just created (adjust the path if your folder is named differently)
const productModel = require('../models/productModel.js');

const fetchAllProducts = async (req, res) => {
  try {
    // You can pass query parameters here later if you want pagination from the app!
    const products = await productModel.fetchAllProduct(20, 0);
    res.json(products);
  } catch (error) {
    console.error("Error in fetchAllProducts controller:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

const addProduct = async (req, res) => {
  try {
    const { 
      code, 
      name, 
      price, 
      costPrice, 
      quantity, 
      unit_id, 
      supplier, 
      invoiceNumber,
      cartonCode,         
      cartonMultiplier,
    } = req.body;

    // 1. 🚨 Parse serials safely (FormData sends arrays as a JSON string)
    let serialsArray = [];
    if (req.body.serials) {
      try {
        serialsArray = JSON.parse(req.body.serials);
      } catch (e) {
        console.warn("Could not parse serials, defaulting to empty array.");
      }
    }

    // 2. 🚨 Get the image path if a file was uploaded by Multer
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // 3. Send parsed data to the model
    const newProduct = await productModel.addProduct({
      code,
      name,
      price: parseFloat(price),
      costPrice: costPrice ? parseFloat(costPrice) : 0,
      quantity: parseFloat(quantity),
      unit_id: parseInt(unit_id),
      supplier,       
      invoiceNumber,   
      cartonCode,         
      cartonMultiplier: cartonMultiplier ? parseInt(cartonMultiplier) : 1,
      serials: serialsArray,
      image_url // 🚨 NEW: Pass the image path to the database model
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error in addProduct controller:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
};

const searchProducts = async (req, res) => {
  try {
    // req.query contains everything after the '?' in the URL 
    // e.g., /api/products/search?query=sandisk&inStockOnly=true
    const products = await productModel.searchProducts(req.query);
    res.json(products);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search products" });
  }
};

module.exports = {
  fetchAllProducts,
  addProduct,
  searchProducts,
};