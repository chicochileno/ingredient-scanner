require('dotenv').config();
const express = require('express');
const cors = require('cors');
const scanRoutes = require('./routes/scan');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // large enough for base64 images

app.use('/scan', scanRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
