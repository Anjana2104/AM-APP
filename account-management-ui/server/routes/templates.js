/**
 * Templates API Routes
 * Handles: PIW Templates, SOW Templates, Holiday Calendars
 * Stores files in SQLite with BLOB support
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db/connection');


// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// GET all templates (optionally filtered by type)
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const type = req.query.type;
    
    let query = 'SELECT id, type, file_name, file_size, mime_type, uploaded_by, uploaded_at, description FROM templates';
    let params = [];
    
    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY uploaded_at DESC';
    
    const templates = db.all(query, params);
    res.json(templates || []);
  } catch (error) {
    console.error('❌ Error fetching templates:', error.message);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET single template by ID (for download)
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const template = db.get(
      'SELECT id, file_name, file_data, mime_type FROM templates WHERE id = ?',
      [req.params.id]
    );
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // sql.js returns BLOB as Uint8Array — convert to Buffer for Express to send correctly
    const fileBuffer = Buffer.from(template.file_data);

    // Determine correct MIME type based on file extension (browser MIME detection can be wrong)
    const fileName = template.file_name || '';
    let mimeType = template.mime_type || 'application/octet-stream';
    if (fileName.endsWith('.xlsm')) {
      mimeType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    } else if (fileName.endsWith('.xlsx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileName.endsWith('.docx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (fileName.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    }
    
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.set('Content-Length', fileBuffer.length);
    res.end(fileBuffer);
  } catch (error) {
    console.error('❌ Error downloading template:', error.message);
    res.status(500).json({ error: 'Failed to download template' });
  }
});

// POST upload new template
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const { type, description } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Template type is required' });
    }
    
    
    const db = await getDb();
    const now = new Date().toISOString();
    const templateId = `tpl_${Date.now()}`;
    
    // Delete existing template of same type (keep only latest)
    db.run('DELETE FROM templates WHERE type = ?', [type]);
    
    // sql.js requires Uint8Array for BLOB columns; convert Buffer if needed
    const fileData = new Uint8Array(req.file.buffer);
    
    // Insert new template with file data
    db.run(
      `INSERT INTO templates (id, type, file_name, file_size, file_data, mime_type, uploaded_by, uploaded_at, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        type,
        req.file.originalname,
        req.file.size,
        fileData,
        req.file.mimetype,
        'system',
        now,
        description || '',
        now,
        now
      ]
    );
    
    
    res.json({
      id: templateId,
      type,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: now,
      description: description || ''
    });
  } catch (error) {
    console.error('❌ Error uploading template:', error.message);
    res.status(500).json({ error: 'Failed to upload template' });
  }
});

// DELETE template by ID
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Error deleting template:', error.message);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});


module.exports = router;

