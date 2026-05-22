// Vercel serverless entry point — re-exports the Express app
const app = require('../school-backend/server');
module.exports = app;
