const express = require('express');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_BASE_URL = 'http://162.43.88.12/v1';

app.post('/api/audio-to-text', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);
    formData.append('user', req.body.user);

    const response = await axios.post(`${DIFY_API_BASE_URL}/audio-to-text`, formData, {
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        ...formData.getHeaders()
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

app.post('/api/chat-messages', async (req, res) => {
  try {
    const response = await axios.post(`${DIFY_API_BASE_URL}/chat-messages`, req.body, {
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat response' });
  }
});

app.post('/api/text-to-audio', async (req, res) => {
  try {
    const response = await axios.post(`${DIFY_API_BASE_URL}/text-to-audio`, req.body, {
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));