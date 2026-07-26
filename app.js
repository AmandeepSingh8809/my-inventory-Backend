require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Highly recommended so your mobile app can talk to it

const productRoutes = require("./routes/productRoutes.js");
const salesRoutes = require("./routes/salesroutes.js");
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json()); // Tells Express to parse incoming JSON data

// Routes
app.use('/', productRoutes);
app.use('/',salesRoutes);

// Export the app so server.js can use it!
module.exports = app;