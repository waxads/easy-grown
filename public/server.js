const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// บอก Server ให้หาไฟล์หน้าเว็บในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));
// เปิดให้เข้าถึงรูปภาพที่อัปโหลดได้
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 1. เชื่อมต่อฐานข้อมูล
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'easygrow_db'
});

// 2. ตั้งค่าการอัปโหลดรูป
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
const upload = multer({ storage: storage });

// ==========================================
// 🟢 API Routes: Vegetables (จัดการข้อมูลผัก)
// ==========================================

// ดึงข้อมูลผัก
app.get('/api/vegetables', (req, res) => {
    const sql = "SELECT * FROM vegetables";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        
        const vegs = results.map(v => ({
            ...v,
            water: JSON.parse(v.water || '[]'),
            regions: JSON.parse(v.regions || '[]'),
            steps: JSON.parse(v.steps || '[]'),
            moreTips: JSON.parse(v.more_tips || '[]'),
            image: v.image_url ? `/uploads/${path.basename(v.image_url)}` : ''
        }));
        res.json(vegs);
    });
});

// เพิ่มผักใหม่ + รูปภาพ
app.post('/api/vegetables', upload.single('imageFile'), (req, res) => {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;

    const sql = `INSERT INTO vegetables 
                 (name, harvest_time, water, sunlight, months, regions, image_url, description, steps, more_tips) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        name, harvestTime, water, sunlight, months, regions, imageUrl, description, steps, moreTips
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Success', id: result.insertId });
    });
});

// ลบข้อมูลผัก
app.delete('/api/vegetables/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM vegetables WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Deleted successfully' });
    });
});

// ==========================================
// 🟡 API Routes: Planting Log (บันทึกการปลูก)
// ==========================================

// 1. ดึงข้อมูลการปลูก (เฉพาะของ User นั้น)
app.get('/api/planting-log', (req, res) => {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ error: 'Email required' });

    const sql = "SELECT * FROM planting_log WHERE user_email = ?";
    db.query(sql, [userEmail], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. เพิ่มบันทึกการปลูกใหม่
app.post('/api/planting-log', (req, res) => {
    const { ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays } = req.body;
    
    const sql = `INSERT INTO planting_log 
    (user_email, vegetable_id, vegetable_name, status, planted_date, expected_date, location, notes, watering_interval_days, last_watered_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    // ให้ last_watered_date เริ่มต้นเท่ากับ plantedDate
    const values = [ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays, plantedDate];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Database Error:", err); // <-- ให้มันฟ้องใน Terminal
            return res.status(500).json(err);
        }
        res.json({ message: 'Log added', id: result.insertId });
    });
});

// 3. อัปเดตสถานะ (Update Status)
app.put('/api/planting-log/:id', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    const sql = "UPDATE planting_log SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Status updated' });
    });
});

// 4. อัปเดตวันที่รดน้ำ (Update Last Watered Date)
app.put('/api/planting-log/:id/water', (req, res) => {
    const id = req.params.id;
    const { lastWateredDate } = req.body;

    const sql = "UPDATE planting_log SET last_watered_date = ? WHERE id = ?";
    db.query(sql, [lastWateredDate, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Watered successfully' });
    });
});

// ==========================================
// 🔵 API Routes: User / Auth (ระบบสมาชิก)
// ==========================================

// Login (ตรวจสอบอีเมลและรหัสผ่าน)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length > 0) {
            const user = results[0];
            if (password === user.password) {
                const userData = { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    role: user.role 
                };
                res.json({ success: true, user: userData });
            } else {
                res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
            }
        } else {
            res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานนี้' });
        }
    });
});

// Register (สมัครสมาชิก)
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')";
    
    db.query(sql, [name, email, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
            }
            return res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
        }
        res.json({ message: 'User registered', id: result.insertId });
    });
});

// ==========================================
// 🚀 Start Server (จุดเดียวเท่านั้น)
// ==========================================
app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});
