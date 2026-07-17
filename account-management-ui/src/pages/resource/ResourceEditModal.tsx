import React from 'react';
import dayjs from 'dayjs';
import { AutoComplete, Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { ResourceRow } from '../../types/resource';
import type { SelectOption } from './resourceTypes';

export interface ResourceEditModalProps {
  open: boolean;
  editingResource: ResourceRow | null;
  form: FormInstance;
  engagementOptions: SelectOption[];
  onClose: () => void;
  onSubmit: (values: any) => Promise<void> | void;
}

export const ResourceEditModal: React.FC<ResourceEditModalProps> = ({
  open,
  editingResource,
  form,
  engagementOptions,
  onClose,
  onSubmit,
}) => {
  const allocationRows = Form.useWatch('allocationEntries', form) as
    | Array<{ allocationPercentage?: number | null }>
    | undefined;

  const totalAllocation = React.useMemo(
    () => (allocationRows || []).reduce((sum, entry) => {
      const pct = Number(entry?.allocationPercentage);
      if (!Number.isFinite(pct)) return sum;
      return sum + Math.max(0, Math.min(200, pct));
    }, 0),
    [allocationRows],
  );

  return (
    <Drawer
      title={editingResource ? `Edit - ${editingResource.empName || 'Resource'}` : 'Add New Employee'}
      placement="right"
      onClose={onClose}
      open={open}
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off">
      <Form.Item label="RA ID" name="raId" rules={[{ required: true, message: 'RA ID is required' }]}>
        <Input placeholder="e.g., RA001" disabled={!!editingResource} style={editingResource ? { color: '#595959', background: '#f5f5f5' } : {}} />
      </Form.Item>

      <Form.Item label="Employee Name" name="empName" rules={[{ required: true, message: 'Employee name is required' }]}>
        <Input placeholder="Full name" />
      </Form.Item>

      <Form.Item
        label="Email"
        name="emailId"
        rules={[
          { required: true, message: 'Email is required' },
          { type: 'email', message: 'Invalid email format' },
        ]}
      >
        <Input placeholder="email@example.com" type="email" />
      </Form.Item>

      <Form.Item label="PIW Role" name="piwRole" rules={[{ required: true, message: 'PIW Role is required' }]}>
        <Input placeholder="e.g., Developer, Manager" />
      </Form.Item>

      <Form.Item label="Roles/Domains (comma-separated)" name="roleOrDomain" rules={[{ required: true, message: 'At least one role/domain is required' }]}>
        <Input.TextArea rows={3} placeholder="e.g., Full Stack, Backend, DevOps" />
      </Form.Item>

      <Form.Item label="Allocation Status" name="allocationStatus" rules={[{ required: true, message: 'Allocation status is required' }]}>
        <Select
          options={[
            { label: 'Available', value: 'Available' },
            { label: 'Shortlisted', value: 'Shortlisted' },
            { label: 'Offered', value: 'Offered' },
            { label: 'Selected', value: 'Selected' },
            { label: 'Joined', value: 'Joined' },
          ]}
          placeholder="Select status"
        />
      </Form.Item>

      <Form.Item
        label="Previous Workex (Yr)"
        name="previousWorkex"
        rules={[

          {
            validator(_, value) {
              const num = parseFloat(String(value ?? ''));
              if (value === '' || value == null) return Promise.resolve();
              if (isNaN(num) || num < 0 || num > 100) return Promise.reject(new Error('Must be a number between 0 and 100'));
              return Promise.resolve();
            },
          },
        ]}
        getValueProps={(value) => ({ value: value != null && value !== '' ? parseFloat(String(value).replace(/[^\d.]/g, '')) || 0 : null })}
        getValueFromEvent={(value: number | null) => value != null ? String(value) : ''}
      >
        <InputNumber min={0} precision={2} addonAfter="yrs" style={{ width: '100%', fontSize: '12px' }} size="small" />
      </Form.Item>

      <Form.Item
        label="Date of Joining"
        name="doj"
        rules={[{ required: true, message: 'DOJ is required' }]}
        getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
        getValueFromEvent={(date: any) => date ? date.format('YYYY-MM-DD') : ''}
      >
        <DatePicker style={{ width: '100%', fontSize: '12px' }} size="small" getPopupContainer={(trigger) => trigger.parentElement || document.body} />
      </Form.Item>

      <Form.Item
        label="Total Workex (Yr)"
        name="totalWorkex"
        rules={[
          { required: true, message: 'Total work experience is required' },
          {
            validator(_, value) {
              const num = parseFloat(String(value ?? ''));
              if (value === '' || value == null) return Promise.resolve();
              if (isNaN(num) || num < 0 || num > 100) return Promise.reject(new Error('Must be a number between 0 and 100'));
              return Promise.resolve();
            },
          },
        ]}
        getValueProps={(value) => ({ value: value != null && value !== '' ? parseFloat(String(value).replace(/[^\d.]/g, '')) || 0 : null })}
        getValueFromEvent={(value: number | null) => value != null ? String(value) : ''}
      >
        <InputNumber min={0} precision={2} addonAfter="yrs" style={{ width: '100%', fontSize: '12px' }} size="small" />
      </Form.Item>

        <Form.List name="allocationEntries">
          {(fields, { add, remove }) => (
            <div style={{ marginBottom: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Project Allocations</strong>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => add({ engagementName: '', allocationPercentage: null, engagementStartDate: '', engagementEndDate: '' })}
                >
                  Add Project
                </Button>
              </Space>

              {fields.map(({ key, name, ...restField }) => (
                <div key={key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 8 }}>
                    <Form.Item
                      {...restField}
                      label="Project"
                      name={[name, 'engagementName']}
                      rules={[{ required: true, message: 'Project name is required' }]}
                    >
                      <AutoComplete
                        options={engagementOptions}
                        placeholder="Project / Engagement name"
                        filterOption={(inputValue, option) => String(option?.label || '').toLowerCase().includes(inputValue.toLowerCase())}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      label="Allocation %"
                      name={[name, 'allocationPercentage']}
                      rules={[{ required: true, message: 'Allocation % is required' }, { type: 'number', min: 0, max: 200, message: 'Must be between 0 and 200' }]}
                    >
                      <InputNumber min={0} max={200} step={5} addonAfter="%" style={{ width: '100%' }} />
                    </Form.Item>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start' }}>
                    <Form.Item
                      {...restField}
                      label="Start Date"
                      name={[name, 'engagementStartDate']}
                      getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
                      getValueFromEvent={(date: dayjs.Dayjs | null) => (date ? date.format('YYYY-MM-DD') : '')}
                    >
                      <DatePicker style={{ width: '100%' }} size="small" getPopupContainer={(trigger) => trigger.parentElement || document.body} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      label="End Date"
                      name={[name, 'engagementEndDate']}
                      dependencies={[['allocationEntries', name, 'engagementStartDate']]}
                      getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
                      getValueFromEvent={(date: dayjs.Dayjs | null) => (date ? date.format('YYYY-MM-DD') : '')}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            const start = getFieldValue(['allocationEntries', name, 'engagementStartDate']);
                            if (!value || !start) return Promise.resolve();
                            if (dayjs(value).isBefore(dayjs(start), 'day')) {
                              return Promise.reject(new Error('End date must be on/after start date'));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <DatePicker style={{ width: '100%' }} size="small" getPopupContainer={(trigger) => trigger.parentElement || document.body} />
                    </Form.Item>
                    <Form.Item label=" ">
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        title="Remove this project allocation"
                      />
                    </Form.Item>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Form.List>

        <Form.Item label="Overall Allocation % (Auto-calculated)">
          <InputNumber value={totalAllocation} disabled addonAfter="%" style={{ width: '100%' }} />
        </Form.Item>

      <Form.Item label="Skills (comma-separated)" name="skills">
        <Input.TextArea rows={4} placeholder="e.g., Java, Spring Boot, React" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          {editingResource ? 'Update' : 'Add'}
        </Button>
      </Form.Item>
      </Form>
    </Drawer>
  );
};
