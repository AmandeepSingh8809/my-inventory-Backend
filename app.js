require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Highly recommended so your mobile app can talk to it

const productRoutes = require("./routes/productRoutes");
const salesRoutes = require("./routes/salesroutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const financeRoutes = require("./routes/financeRoutes");
const app = express();
const path = require('path');
// Middleware
app.use(cors());
app.use(bodyParser.json()); // Tells Express to parse incoming JSON data
app.use('/uploads', express.static(path.join(__dirname,'uploads')));
// Routes
app.use('/', productRoutes);
app.use('/',salesRoutes);
app.use('/',purchaseRoutes);
app.use('/',financeRoutes);
// Export the app so server.js can use it!
module.exports = app;