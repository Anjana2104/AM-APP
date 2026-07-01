import { AutoComplete, DatePicker, Form, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { SelectOption, ResourceModalState } from './types';

export interface ResourceEditModalProps {
  editModal: ResourceModalState;
  form: FormInstance;
  onCancel: () => void;
  onSave: () => void;
  confirmLoading: boolean;
  projectEngagementOptions: SelectOption[];
  beelineRequestOptions: SelectOption[];
  ensureActiveRequestOptions: () => Promise<void>;
}

export function ResourceEditModal({ editModal, form, onCancel, onSave, confirmLoading, projectEngagementOptions, beelineRequestOptions, ensureActiveRequestOptions }: ResourceEditModalProps) {
  return (
    <Modal
      title={<span style={{ fontSize: '14px' }}>Edit Engagement Details — {editModal.resource?.empName}</span>}
      open={editModal.open}
      onCancel={onCancel}
      onOk={onSave}
      okText="Save"
      confirmLoading={confirmLoading}
      width={440}
    >
      <Form form={form} layout="vertical" size="small" style={{ paddingTop: 8 }}>
        <Form.Item label="Engagement / Project Name" name="engagement">
          <AutoComplete
            placeholder="Type or select engagement / project name"
            options={projectEngagementOptions}
            filterOption={(input, option) => String(option?.label || option?.value || '').toLowerCase().includes(input.toLowerCase())}
            style={{ fontSize: '12px' }}
          />
        </Form.Item>
        <Form.Item label="Engagement Start Date" name="engagementStartDate">
          <DatePicker
            style={{ width: '100%', fontSize: '12px' }}
            format="YYYY-MM-DD"
            placeholder="Select start date"
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
          />
        </Form.Item>
        <Form.Item label="Engagement End Date" name="engagementEndDate">
          <DatePicker
            style={{ width: '100%', fontSize: '12px' }}
            format="YYYY-MM-DD"
            placeholder="Select end date"
            getPopupContainer={(trigger) => trigger.parentElement || document.body}
          />
        </Form.Item>
        <Form.Item label="Beeline ID" name="beelineId">
          <Select
            showSearch
            allowClear
            placeholder="Link Beeline request…"
            options={beelineRequestOptions}
            filterOption={(input, option) => (option?.value as string || '').toLowerCase().includes(input.toLowerCase())}
            onFocus={async () => {
              if (!beelineRequestOptions.length) {
                try {
                  await ensureActiveRequestOptions();
                } catch {
                }
              }
            }}
            style={{ fontSize: '12px' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
