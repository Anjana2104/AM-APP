/**
 * db/seed-config.js
 * Seeds default configuration types, items, and app values.
 * Run: node db/seed-config.js  (from server/ directory)
 */

const { getDb, resetDb } = require('./connection');

async function seedConfig() {
  const db = await getDb();
  const now = new Date().toISOString();

  // ── Config types ──────────────────────────────────────────────────────
  const types = [
    {
      type_id: 'request_processing_status',
      name: 'Request Processing Status',
      description: 'Status values used in the Request Management processing pipeline.',
      built_in: 1,
      linked_to: JSON.stringify(['request_processing_status_field']),
    },
    {
      type_id: 'request_overall_status',
      name: 'Request Overall Status',
      description: 'High-level status values for requests (e.g. Not Started, In Progress).',
      built_in: 1,
      linked_to: JSON.stringify(['request_overall_status_field']),
    },
  ];

  for (const t of types) {
    const existing = db.get('SELECT id FROM app_config_types WHERE type_id = ?', [t.type_id]);
    if (!existing) {
      db.run(
        `INSERT INTO app_config_types (type_id, name, description, built_in, linked_to, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [t.type_id, t.name, t.description, t.built_in, t.linked_to, now, now]
      );
      console.log('Inserted type:', t.type_id);
    } else {
      console.log('Type already exists:', t.type_id);
    }
  }

  // ── Items for request_processing_status ───────────────────────────────
  const processingItems = [
    { item_value: 'accepted_staffing', label: 'Accepted by Staffing Team', color: 'blue' },
    { item_value: 'resource_shortlisted', label: 'Resource Shortlisted', color: 'cyan' },
    { item_value: 'uploaded_profile_beeline', label: 'Uploaded Profile on Beeline', color: 'geekblue' },
    { item_value: 'resource_assessment_scheduled', label: 'Resource Assessment Scheduled', color: 'purple' },
    { item_value: 'resource_assessment_completed', label: 'Resource Assessment Completed', color: 'gold' },
    { item_value: 'resource_selected', label: 'Resource Selected', color: 'green' },
    { item_value: 'resource_rejected', label: 'Resource Rejected', color: 'red' },
    { item_value: 'zs_onboarding_initiated', label: 'ZS Onboarding Initiated', color: 'lime' },
    { item_value: 'onboarded_in_zs', label: 'Onboarded in ZS', color: 'success' },
    { item_value: 'zs_offboarding_initiated', label: 'ZS Offboarding Initiated', color: 'orange' },
    { item_value: 'resource_offboarded', label: 'Resource Offboarded', color: 'default' },
  ];

  processingItems.forEach((item, idx) => {
    const existing = db.get(
      'SELECT id FROM app_config_items WHERE type_id = ? AND item_value = ?',
      ['request_processing_status', item.item_value]
    );
    if (!existing) {
      db.run(
        `INSERT INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['request_processing_status', item.item_value, item.label, item.color, idx, now, now]
      );
    }
  });
  console.log('Seeded request_processing_status items');

  // ── Items for request_overall_status ─────────────────────────────────
  const overallItems = [
    { item_value: 'not_started', label: 'Not Started', color: 'blue' },
    { item_value: 'in_progress', label: 'In Progress', color: 'gold' },
    { item_value: 'completed', label: 'Completed', color: 'green' },
    { item_value: 'blocked', label: 'Blocked', color: 'red' },
    { item_value: 'cancelled', label: 'Cancelled', color: 'default' },
  ];

  overallItems.forEach((item, idx) => {
    const existing = db.get(
      'SELECT id FROM app_config_items WHERE type_id = ? AND item_value = ?',
      ['request_overall_status', item.item_value]
    );
    if (!existing) {
      db.run(
        `INSERT INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['request_overall_status', item.item_value, item.label, item.color, idx, now, now]
      );
    }
  });
  console.log('Seeded request_overall_status items');

  // ── Default app value ─────────────────────────────────────────────────
  const existingVal = db.get('SELECT id FROM app_values WHERE key = ?', ['SOW_STORAGE_URL']);
  if (!existingVal) {
    db.run(
      `INSERT INTO app_values (key, value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [
        'SOW_STORAGE_URL',
        'https://rockwellautomation-my.sharepoint.com/:f:/r/personal/anjana_sharma_rockwellautomation_com/Documents/Anjana%20Sharma%20-%20All%20Important%20Documents/1.%20My%20work/RA%20Work/New%20folder?csf=1&web=1&e=Mchxcf',
        'SharePoint folder URL where SOW documents are stored',
        now,
        now,
      ]
    );
    console.log('Inserted default SOW_STORAGE_URL');
  } else {
    console.log('SOW_STORAGE_URL already exists');
  }

  console.log('Config seed complete.');
  db.close();
  resetDb();
}

seedConfig().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
