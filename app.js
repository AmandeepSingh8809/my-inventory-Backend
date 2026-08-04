require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); 

const productRoutes = require("./routes/productRoutes");
const salesRoutes = require("./routes/salesroutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const financeRoutes = require("./routes/financeRoutes");
const shopRoutes = require("./routes/shopRoutes");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const app = express();
const path = require('path');

// 🚨 UPGRADED CORS Middleware
// This tells Express to allow our custom 'x-shop-code' header!
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-code'] 
}));

app.use(bodyParser.json()); 
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// Routes
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', salesRoutes);
app.use('/', purchaseRoutes);
app.use('/', financeRoutes);
app.use('/', shopRoutes);
app.use('/',employeeRoutes);
// Export the app so server.js can use it!
module.exports = app;