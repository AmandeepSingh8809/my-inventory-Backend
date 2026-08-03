const ShopModel = require('../models/shopModel');

const getMyShops = async (req, res) => {
  try {
    const userId = req.user.id; // From verifyToken middleware
    const shops = await ShopModel.getShopsByUser(userId);
    
    res.status(200).json(shops);
  } catch (error) {
    console.error("Fetch shops error:", error);
    res.status(500).json({ error: "Failed to fetch your shops" });
  }
};

const createNewShop = async (req, res) => {
  try {
    const { shopName, address, pincode } = req.body;
    const userId = req.user.id; // From verifyToken middleware

    if (!shopName || !address || !pincode) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newShop = await ShopModel.createShop(shopName, address, pincode, userId);

    res.status(201).json({
      message: "Store created successfully",
      shop: newShop
    });
  } catch (error) {
    console.error("Create shop error:", error);
    res.status(500).json({ error: "Server error while creating store" });
  }
};

module.exports = { 
  getMyShops, 
  createNewShop 
};