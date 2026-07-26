// Import the configured Express app from app.js
const app = require('./app.js');

// Define the port (uses your .env file, or defaults to 5000)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Node Server running on http://localhost:${PORT}`);
});