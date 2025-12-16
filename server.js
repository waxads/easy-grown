const express = require('express');
// ❌ ปิด MySQL ชั่วคราว
// const mysql = require('mysql2');

const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// เสิร์ฟไฟล์หน้าเว็บ
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ===============================
// Upload (ยังใช้ได้ปกติ)
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ===============================
// Mock APIs (แทน MySQL)
// ===============================
app.get('/api/vegetables', (req, res) => res.json([]));
app.post('/api/vegetables', upload.single('imageFile'), (req, res) =>
  res.json({ message: 'Mock success' })
);
app.delete('/api/vegetables/:id', (req, res) =>
  res.json({ message: 'Mock delete success' })
);

app.get('/api/planting-log', (req, res) => res.json([]));
app.post('/api/planting-log', (req, res) =>
  res.json({ message: 'Mock log added' })
);
app.put('/api/planting-log/:id', (req, res) =>
  res.json({ message: 'Mock status updated' })
);
app.put('/api/planting-log/:id/water', (req, res) =>
  res.json({ message: 'Mock watered' })
);

app.post('/api/login', (req, res) =>
  res.json({
    success: true,
    user: { id: 1, name: 'Demo User', email: req.body.email, role: 'user' }
  })
);

app.post('/api/register', (req, res) =>
  res.json({ message: 'Mock register success' })
);

// ===============================
// Start server
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
