/**
 * Trigger Source Definitions — single source of truth for all notification-trigger-able modules.
 *
 * How to add a new module:
 *   1. Add an entry to TRIGGER_SOURCES below with the DB table name, label, and trackable fields.
 *   2. Import { evaluateTriggers } in the route file and call it in the PUT + bulk POST handlers,
 *      passing changedValues and old/new records.
 *
 * Special field values (reserved):
 *   __any__             — wildcard: fires on ANY scalar field change in the source table
 *   __revenue__         — aggregate: fires when any monthly milestone data changes (SOW tab)
 *   __invoice_amounts__ — aggregate: fires when any monthly invoice amount changes (Invoice tab)
 *   __bulk_insert__     — event: fires when new records are added via bulk upload
 *   __delete_all__      — event: fires when ALL records in the source are deleted
 *   __record_delete__   — event: fires when a SINGLE record is deleted
 *
 * To add a new aggregate/event field:
 *   1. Add it to the relevant source's fields array below
 *   2. Add it to FIELD_LABEL_MAP below
 *   3. Add it to SPECIAL_AGGREGATE_FIELDS in triggerEvaluator.js
 *   4. Pass `changedValues[field] = summaryString` from the route before calling evaluateTriggers
 */

const TRIGGER_SOURCES = [
  {
    label: 'SOW Details',
    value: 'finance_projects',
    module: 'finance',
    fields: [
      { label: '★ Any field change (wildcard)', value: '__any__' },
      { label: '📅 All monthly milestone data', value: '__revenue__' },
      { label: '📤 Bulk data upload (new records)', value: '__bulk_insert__' },
      { label: '🗑 All records deleted', value: '__delete_all__' },
      { label: '❌ Single record deleted', value: '__record_delete__' },
      { label: 'Owner', value: 'owner' },
      { label: 'Company', value: 'company' },
      { label: 'Space', value: 'space' },
      { label: 'Status', value: 'status' },
      { label: 'Project Name', value: 'project' },
      { label: 'Comments', value: 'comments' },
    ],
  },
  {
    label: 'Invoice Details',
    value: 'invoice_projects',
    module: 'invoice',
    fields: [
      { label: '★ Any field change (wildcard)', value: '__any__' },
      { label: '📅 All monthly invoice data', value: '__invoice_amounts__' },
      { label: '📤 Bulk data upload (new records)', value: '__bulk_insert__' },
      { label: '🗑 All records deleted', value: '__delete_all__' },
      { label: '❌ Single record deleted', value: '__record_delete__' },
      { label: 'Company', value: 'company' },
      { label: 'Status', value: 'status' },
      { label: 'Project Name', value: 'project' },
      { label: 'Comments', value: 'comments' },
    ],
  },
  {
    label: 'Request Management',
    value: 'client_requests',
    module: 'requests',
    fields: [
      { label: '★ Any field change (wildcard)', value: '__any__' },
      { label: '📤 Bulk data upload (new records)', value: '__bulk_insert__' },
      { label: '🗑 All records deleted', value: '__delete_all__' },
      { label: '❌ Single record deleted', value: '__record_delete__' },
      { label: 'Processing Status', value: 'processing_status' },
      { label: 'Overall Status', value: 'overall_status' },
      { label: 'Account Anchor', value: 'account_anchor' },
      { label: 'Request Type', value: 'request_type' },
      { label: 'Description', value: 'description' },
      { label: 'Raised By', value: 'raised_by' },
    ],
  },
  {
    label: 'Internal Process',
    value: 'ra_process',
    module: 'process',
    fields: [
      { label: '★ Any field change (wildcard)', value: '__any__' },
      { label: '📤 Bulk data upload (new records)', value: '__bulk_insert__' },
      { label: '🗑 All records deleted', value: '__delete_all__' },
      { label: '❌ Single record deleted', value: '__record_delete__' },
      { label: 'Account Anchor', value: 'account_anchor' },
      { label: 'PIW', value: 'piw' },
      { label: 'Active / Status', value: 'active' },
      { label: 'Signed SOW', value: 'signed_sow' },
      { label: 'Budget', value: 'budget' },
      { label: 'Salesforce ID', value: 'salesforce_id' },
      { label: 'PROMS ID', value: 'proms_id' },
      { label: 'Open Air Code', value: 'open_air_code' },
      { label: 'Comments', value: 'comments' },
    ],
  },
];

/**
 * Flat map of field value → human-readable label, merged across all sources.
 * Used by triggerEvaluator.js when building notification message text.
 */
const FIELD_LABEL_MAP = {
  __any__: 'Any field',
  __revenue__: 'Monthly Milestone Data',
  __invoice_amounts__: 'Monthly Invoice Data',
  __bulk_insert__: 'Bulk Upload',
  __delete_all__: 'All Records Deleted',
  __record_delete__: 'Record Deleted',
};

for (const source of TRIGGER_SOURCES) {
  for (const field of source.fields) {
    if (!FIELD_LABEL_MAP[field.value]) {
      FIELD_LABEL_MAP[field.value] = field.label;
    }
  }
}

module.exports = { TRIGGER_SOURCES, FIELD_LABEL_MAP };
