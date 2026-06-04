/**
 * Config API routes
 * Base path: /api/config
 *
 * GET    /                          - all config types with items
 * POST   /types                     - create type
 * PUT    /types/:typeId             - update type
 * DELETE /types/:typeId             - delete type + items
 * DELETE /types                     - delete all non-builtin types + items
 * POST   /types/:typeId/items       - add item
 * PUT    /types/:typeId/items/:val  - update item
 * DELETE /types/:typeId/items/:val  - delete item
 * PUT    /types/:typeId/items       - bulk replace items
 * POST   /bulk                      - bulk upsert types+items from upload
 * GET    /values                    - all app values
 * POST   /values                    - upsert app value
 * DELETE /values/:key               - delete one app value
 * DELETE /values                    - delete all app values
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

// ── Helpers ───────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function rowToType(row, items) {
  let linkedTo = [];
  try { linkedTo = JSON.parse(row.linked_to || '[]'); } catch { /* ignore */ }
  return {
    typeId: row.type_id,
    name: row.name,
    description: row.description || '',
    builtIn: !!row.built_in,
    linkedTo,
    sortOrder: row.sort_order || 0,
    items: items || [],
  };
}

function rowToItem(row) {
  return {
    itemValue: row.item_value,
    label: row.label,
    color: row.color || 'default',
    sortOrder: row.sort_order || 0,
  };
}

// ── GET / ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const types = db.all('SELECT * FROM app_config_types ORDER BY sort_order, name');
    const items = db.all('SELECT * FROM app_config_items ORDER BY sort_order, label');

    const itemsByType = {};
    items.forEach(item => {
      if (!itemsByType[item.type_id]) itemsByType[item.type_id] = [];
      itemsByType[item.type_id].push(rowToItem(item));
    });

    const configTypes = types.map(t => rowToType(t, itemsByType[t.type_id] || []));
    res.json({ configTypes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /types ───────────────────────────────────────────────────────

router.post('/types', async (req, res) => {
  const { typeId, name, description, builtIn, linkedTo } = req.body;
  if (!typeId || !name) return res.status(400).json({ error: 'typeId and name required' });
  try {
    const db = await getDb();
    const ts = now();
    db.run(
      `INSERT INTO app_config_types (type_id, name, description, built_in, linked_to, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [typeId, name, description || '', builtIn ? 1 : 0, JSON.stringify(linkedTo || []), ts, ts]
    );
    res.json({ ok: true, typeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /types/:typeId ────────────────────────────────────────────────

router.put('/types/:typeId', async (req, res) => {
  const { typeId } = req.params;
  const { name, description, linkedTo } = req.body;
  try {
    const db = await getDb();
    const existing = db.get('SELECT * FROM app_config_types WHERE type_id = ?', [typeId]);
    if (!existing) return res.status(404).json({ error: 'Type not found' });

    db.run(
      `UPDATE app_config_types SET
         name = ?, description = ?, linked_to = ?, updated_at = ?
       WHERE type_id = ?`,
      [
        name !== undefined ? name : existing.name,
        description !== undefined ? description : existing.description,
        linkedTo !== undefined ? JSON.stringify(linkedTo) : existing.linked_to,
        now(),
        typeId,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /types (all non-builtin) ───────────────────────────────────

router.delete('/types', async (req, res) => {
  try {
    const db = await getDb();
    const nonBuiltin = db.all('SELECT type_id FROM app_config_types WHERE built_in = 0');
    for (const row of nonBuiltin) {
      db.run('DELETE FROM app_config_items WHERE type_id = ?', [row.type_id]);
    }
    db.run('DELETE FROM app_config_types WHERE built_in = 0');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /types/:typeId ─────────────────────────────────────────────

router.delete('/types/:typeId', async (req, res) => {
  const { typeId } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM app_config_items WHERE type_id = ?', [typeId]);
    db.run('DELETE FROM app_config_types WHERE type_id = ?', [typeId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /types/:typeId/items ─────────────────────────────────────────

router.post('/types/:typeId/items', async (req, res) => {
  const { typeId } = req.params;
  const { itemValue, label, color } = req.body;
  if (!itemValue || !label) return res.status(400).json({ error: 'itemValue and label required' });
  try {
    const db = await getDb();
    const maxRow = db.get('SELECT MAX(sort_order) as m FROM app_config_items WHERE type_id = ?', [typeId]);
    const sortOrder = ((maxRow && maxRow.m != null) ? maxRow.m : -1) + 1;
    const ts = now();
    db.run(
      `INSERT OR REPLACE INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [typeId, itemValue, label, color || 'default', sortOrder, ts, ts]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /types/:typeId/items (bulk replace) ───────────────────────────

router.put('/types/:typeId/items', async (req, res) => {
  const { typeId } = req.params;
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
  try {
    const db = await getDb();
    db.run('DELETE FROM app_config_items WHERE type_id = ?', [typeId]);
    const ts = now();
    items.forEach((item, idx) => {
      db.run(
        `INSERT INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [typeId, item.itemValue, item.label, item.color || 'default', item.sortOrder ?? idx, ts, ts]
      );
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /types/:typeId/items/:itemValue ───────────────────────────────

router.put('/types/:typeId/items/:itemValue', async (req, res) => {
  const { typeId, itemValue } = req.params;
  const { label, color } = req.body;
  try {
    const db = await getDb();
    const existing = db.get(
      'SELECT * FROM app_config_items WHERE type_id = ? AND item_value = ?',
      [typeId, itemValue]
    );
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    db.run(
      'UPDATE app_config_items SET label = ?, color = ?, updated_at = ? WHERE type_id = ? AND item_value = ?',
      [label !== undefined ? label : existing.label, color !== undefined ? color : existing.color, now(), typeId, itemValue]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /types/:typeId/items/:itemValue ────────────────────────────

router.delete('/types/:typeId/items/:itemValue', async (req, res) => {
  const { typeId, itemValue } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM app_config_items WHERE type_id = ? AND item_value = ?', [typeId, itemValue]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /bulk ────────────────────────────────────────────────────────

router.post('/bulk', async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });
  try {
    const db = await getDb();
    let created = 0;
    let added = 0;
    const ts = now();

    for (const entry of entries) {
      const { name, values } = entry;
      if (!name) continue;

      const nameLower = name.toLowerCase();
      let typeRow = db.get(
        'SELECT * FROM app_config_types WHERE LOWER(name) = ?',
        [nameLower]
      );

      if (!typeRow) {
        const typeId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        db.run(
          `INSERT INTO app_config_types (type_id, name, description, built_in, linked_to, sort_order, created_at, updated_at)
           VALUES (?, ?, '', 0, '[]', 0, ?, ?)`,
          [typeId, name, ts, ts]
        );
        typeRow = { type_id: typeId };
        created++;
      }

      const existingItems = db.all(
        'SELECT label FROM app_config_items WHERE type_id = ?',
        [typeRow.type_id]
      );
      const existingLabels = new Set(existingItems.map(i => i.label.toLowerCase()));

      let sortMax = db.get(
        'SELECT MAX(sort_order) as m FROM app_config_items WHERE type_id = ?',
        [typeRow.type_id]
      );
      let sortOrder = sortMax && sortMax.m != null ? sortMax.m : -1;

      for (const val of (values || [])) {
        const valTrim = val.trim();
        if (!valTrim || existingLabels.has(valTrim.toLowerCase())) continue;
        const itemValue = valTrim.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        sortOrder++;
        db.run(
          `INSERT OR IGNORE INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, 'default', ?, ?, ?)`,
          [typeRow.type_id, itemValue, valTrim, sortOrder, ts, ts]
        );
        existingLabels.add(valTrim.toLowerCase());
        added++;
      }
    }

    res.json({ ok: true, created, added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /values ───────────────────────────────────────────────────────

router.get('/values', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all('SELECT key, value, description FROM app_values ORDER BY key');
    res.json({ values: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /values ──────────────────────────────────────────────────────

router.post('/values', async (req, res) => {
  const { key, value, description } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const db = await getDb();
    const ts = now();
    db.run(
      `INSERT OR REPLACE INTO app_values (key, value, description, created_at, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT created_at FROM app_values WHERE key = ?), ?), ?)`,
      [key, value || '', description || '', key, ts, ts]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /values (all) ──────────────────────────────────────────────

router.delete('/values', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM app_values');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /values/:key ───────────────────────────────────────────────

router.delete('/values/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM app_values WHERE key = ?', [key]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
