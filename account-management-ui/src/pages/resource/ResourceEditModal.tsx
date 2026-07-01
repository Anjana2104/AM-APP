import React from 'react';
import dayjs from 'dayjs';
import { Button, DatePicker, Drawer, Form, Input, InputNumber, Select } from 'antd';
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
}) => (
  <Drawer
    title={editingResource ? `Edit - ${editingResource.empName || 'Resource'}` : 'Add New Employee'}
    placement="right"
    onClose={onClose}
    open={open}
    width={500}
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

      <Form.Item label="Role/Domain" name="roleOrDomain" rules={[{ required: true, message: 'Role/Domain is required' }]}>
        <Input placeholder="e.g., Full Stack, Backend" />
      </Form.Item>

      <Form.Item
        label="Previous Experience"
        name="previousWorkex"
        rules={[
          { required: true, message: 'Previous experience is required' },
          {
            validator(_, value) {
              const num = parseFloat(String(value ?? ''));
              if (value === '' || value == null) return Promise.resolve();
              if (isNaN(num) || num < 0 || num > 100) return Promise.reject(new Error('Must be between 0 and 100 years'));
              return Promise.resolve();
            },
          },
        ]}
        getValueProps={(value) => ({ value: value != null && value !== '' ? parseFloat(String(value).replace(/[^\d.]/g, '')) || 0 : null })}
        getValueFromEvent={(value: number | null) => value != null ? String(value) : ''}
      >
        <InputNumber min={0} precision={1} addonAfter="years" style={{ width: '100%', fontSize: '12px' }} size="small" />
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
        label="Total Experience"
        name="totalWorkex"
        rules={[
          { required: true, message: 'Total experience is required' },
          {
            validator(_, value) {
              const num = parseFloat(String(value ?? ''));
              if (value === '' || value == null) return Promise.resolve();
              if (isNaN(num) || num < 0 || num > 100) return Promise.reject(new Error('Must be between 0 and 100 years'));
              return Promise.resolve();
            },
          },
        ]}
        getValueProps={(value) => ({ value: value != null && value !== '' ? parseFloat(String(value).replace(/[^\d.]/g, '')) || 0 : null })}
        getValueFromEvent={(value: number | null) => value != null ? String(value) : ''}
      >
        <InputNumber min={0} precision={1} addonAfter="years" style={{ width: '100%', fontSize: '12px' }} size="small" />
      </Form.Item>

      <Form.Item label="Current Engagement" name="engagement">
        <Select
          showSearch
          placeholder="Select engagement or project"
          options={engagementOptions}
          filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
          allowClear
        />
      </Form.Item>

      <Form.Item
        label="Engagement Start Date"
        name="engagementStartDate"
        getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
        getValueFromEvent={(date: any) => date ? date.format('YYYY-MM-DD') : ''}
      >
        <DatePicker style={{ width: '100%', fontSize: '12px' }} size="small" getPopupContainer={(trigger) => trigger.parentElement || document.body} />
      </Form.Item>

      <Form.Item
        label="Engagement End Date"
        name="engagementEndDate"
        dependencies={['engagementStartDate']}
        getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
        getValueFromEvent={(date: any) => date ? date.format('YYYY-MM-DD') : ''}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              const start = getFieldValue('engagementStartDate');
              if (!value || !start || value >= start) return Promise.resolve();
              return Promise.reject(new Error('End date must be after start date'));
            },
          }),
        ]}
      >
        <DatePicker style={{ width: '100%', fontSize: '12px' }} size="small" getPopupContainer={(trigger) => trigger.parentElement || document.body} />
      </Form.Item>

      <Form.Item label="Allocation % (0–200)" name="allocationPercentage" rules={[{ type: 'number', min: 0, max: 200, message: 'Must be between 0 and 200' }]}>
        <InputNumber min={0} max={200} step={5} placeholder="e.g., 100" addonAfter="%" style={{ width: '100%', fontSize: '12px' }} />
      </Form.Item>

      <Form.Item label="Skills (comma-separated)" name="skills" rules={[{ required: true, message: 'Skills are required' }]}>
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
