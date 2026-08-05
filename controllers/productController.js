const pool = require("../config/db.js");
const productModel = require('../models/productModel.js');

const fetchAllProducts = async (req, res) => {
  try {
    // 🚨 UPGRADED: Grab the shopCode from the verified JWT token
    const shopCode = req.user?.shopCode;

    // 🚨 UPGRADED: Pass shopCode as the first parameter to the model
    const products = await productModel.fetchAllProduct(shopCode, 20, 0);
    res.json(products);
  } catch (error) {
    console.error("Error in fetchAllProducts controller:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

const addProduct = async (req, res) => {
  try {
    const shopCode = req.user?.shopCode;
    const userId = req.user?.id || req.user?.userId;

    if (!shopCode) {
      return res.status(400).json({ error: "No shop specified in token." });
    }

    // 🔥 STRICT OWNERSHIP & EXISTENCE CHECK:
    // Ensures the shop exists AND the user is explicitly authorized to manage it.
   // 🔥 Corrected query matching your exact schema foreign keys
    const shopCheck = await pool.query(
      `SELECT s.shop_code 
       FROM shops s
       JOIN user_shops us ON s.id = us.shop_id
       WHERE s.shop_code = $1 AND us.user_id = $2`,
      [shopCode, userId]
    );

    if (shopCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: "Access Denied: You are not authorized to add products to this shop." 
      });
    }

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

    // 3. Send parsed data + user_id to the model
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
      image_url,
      shop_code: shopCode, // 🚨 Securely mapped
      user_id: userId      // 🔥 Track who added the product
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error in addProduct controller:", error);
    res.status(500).json({ error: "Failed to add product" });
  }
};

const searchProducts = async (req, res) => {
  try {
    // 🚨 UPGRADED: Grab the shopCode from the verified JWT token
    const shopCode = req.user?.shopCode;
    
    // 🚨 UPGRADED: Inject the shopCode into the query filters before sending to the model
    const filters = { ...req.query, shopCode };

    const products = await productModel.searchProducts(filters);
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