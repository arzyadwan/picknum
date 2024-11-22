const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid'); // Untuk generate User ID unik

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Koneksi ke database MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Kosongkan jika tidak ada password
    database: 'ayong'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

// Endpoint untuk mendapatkan angka unik
app.post('/get-number', (req, res) => {
    const userId = req.body.user_id;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    db.query('SELECT number FROM numbers WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database query failed' });
        }

        // Jika User ID sudah ada, kembalikan angka yang sama
        if (results.length > 0) {
            return res.json({ number: results[0].number, userId });
        }

        // Jika User ID belum ada, ambil angka baru
        db.beginTransaction(err => {
            if (err) {
                return res.status(500).json({ error: 'Failed to start transaction' });
            }

            db.query('SELECT number FROM numbers WHERE user_id IS NULL ORDER BY RAND() LIMIT 1', (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: 'Database query failed' });
                    });
                }

                if (results.length === 0) {
                    return db.rollback(() => {
                        res.status(400).json({ error: 'No numbers available' });
                    });
                }

                const number = results[0].number;

                // Tandai angka sebagai digunakan oleh User ID
                db.query(
                    'UPDATE numbers SET user_id = ? WHERE number = ?',
                    [userId, number],
                    (err, updateResult) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Failed to assign number' });
                            });
                        }

                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    res.status(500).json({ error: 'Failed to commit transaction' });
                                });
                            }

                            // Kirim angka baru dan User ID kembali ke client
                            res.json({ number, userId });
                        });
                    }
                );
            });
        });
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
