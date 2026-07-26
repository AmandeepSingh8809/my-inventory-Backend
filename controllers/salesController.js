const saleModel = require('../models/salesModel');

const processSale = async (req, res) => {
  try {
    const { productId, quantity, unitPrice, totalAmount, paymentMethod, customerInfo } = req.body;
    
    const result = await saleModel.recordSale({
      productId, 
      quantity, 
      unitPrice, 
      totalAmount, 
      paymentMethod, 
      customerInfo
    });

    res.status(201).json({ message: "Sale successful", data: result });

  } catch (error) {
    if (error.message === "Insufficient stock") {
      return res.status(400).json({ error: "Not enough items in stock to complete this sale." });
    }
    res.status(500).json({ error: "Failed to process sale" });
  }
};

module.exports = { 
  processSale 
};