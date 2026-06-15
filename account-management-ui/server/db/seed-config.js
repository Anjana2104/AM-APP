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
    {
      type_id: 'resource_allocation_status',
      name: 'Resource Allocation Status',
      description: 'Allocation pipeline stages for the engagement workflow (Available → Shortlisted → Offered → Selected → Joined). Link to "Allocation Status dropdown" via Manage Links to drive the filter.',
      built_in: 1,
      linked_to: JSON.stringify([]),
    },
    {
      type_id: 'project_engagement',
      name: 'Project / Engagement Names',
      description: 'List of project and engagement names. Link to "Engagement / Project Name dropdown" via Manage Links to drive the engagement dropdowns.',
      built_in: 1,
      linked_to: JSON.stringify([]),
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
    } else {
      // Always update linked_to so new link targets are applied
      db.run(
        `UPDATE app_config_types SET linked_to = ?, description = ?, updated_at = ? WHERE type_id = ?`,
        [t.linked_to, t.description, now, t.type_id]
      );
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

  // ── Items for resource_allocation_status ─────────────────────────────
  // These are the canonical workflow status values the system uses internally.
  // User can manage these via Configuration UI; seed only ensures defaults exist.
  const allocStatusItems = [
    { item_value: 'Available',   label: 'Available',   color: 'warning' },
    { item_value: 'Shortlisted', label: 'Shortlisted', color: 'cyan' },
    { item_value: 'Offered',     label: 'Offered',     color: 'purple' },
    { item_value: 'Selected',    label: 'Selected',    color: 'blue' },
    { item_value: 'Joined',      label: 'Joined',      color: 'success' },
  ];

  allocStatusItems.forEach((item, idx) => {
    const existing = db.get(
      'SELECT id FROM app_config_items WHERE type_id = ? AND item_value = ?',
      ['resource_allocation_status', item.item_value]
    );
    if (!existing) {
      db.run(
        `INSERT INTO app_config_items (type_id, item_value, label, color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['resource_allocation_status', item.item_value, item.label, item.color, idx, now, now]
      );
    }
  });

  // ── Items for project_engagement ─────────────────────────────────────
  // NO hardcoded items — user adds their own values via Configuration > Manage Links.
  // Delete any previously seeded defaults so they don't persist.
  const oldEngagementDefaults = ['Bench', 'ZS', 'ExxonMobil', 'Chevron', 'Shell', 'Internal'];
  oldEngagementDefaults.forEach(v => {
    db.run(
      'DELETE FROM app_config_items WHERE type_id = ? AND item_value = ?',
      ['project_engagement', v]
    );
  });

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
  } else {
  }

  db.close();
  resetDb();
}

seedConfig().then(() => process.exit(0)).catch(err => { process.exit(1); });
