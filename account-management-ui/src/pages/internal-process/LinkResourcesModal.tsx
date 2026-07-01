import React from 'react';
import { Button, Checkbox, DatePicker, Input, Modal, Spin } from 'antd';
import dayjs from 'dayjs';
import { LinkOutlined } from '@ant-design/icons';
import type { ProcRes, ProcessRow } from './types';

interface LinkResourcesModalProps {
  open: boolean;
  row: ProcessRow | null;
  rows: ProcessRow[];
  allProcResources: ProcRes[];
  linkChecked: Set<number>;
  setLinkChecked: React.Dispatch<React.SetStateAction<Set<number>>>;
  linkSearch: string;
  setLinkSearch: (value: string) => void;
  loadingLink: boolean;
  savingLink: boolean;
  linkDates: Record<number, { startDate: string; endDate: string }>;
  setLinkDates: React.Dispatch<React.SetStateAction<Record<number, { startDate: string; endDate: string }>>>;
  onClose: () => void;
  onSave: () => void;
}

export function LinkResourcesModal({ open, row, rows, allProcResources, linkChecked, setLinkChecked, linkSearch, setLinkSearch, loadingLink, savingLink, linkDates, setLinkDates, onClose, onSave }: LinkResourcesModalProps) {
  return (
    <Modal
      title={<span style={{ fontSize: '13px' }}><LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />Link Resources — {row?.sow}</span>}
      open={open}
      onCancel={onClose}
      onOk={onSave}
      okText="Save Links"
      confirmLoading={savingLink}
      width={560}
      okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      footer={[
        <Button key="unlink-all" size="small" danger disabled={linkChecked.size === 0} onClick={() => setLinkChecked(new Set())} style={{ borderRadius: 6, fontSize: '11px', float: 'left' }}>
          Unlink All
        </Button>,
        <span key="count" style={{ fontSize: '11px', color: '#8c8c8c', float: 'left', lineHeight: '24px', marginLeft: 8 }}>
          {linkChecked.size} selected
        </span>,
        <Button key="cancel" size="small" style={{ borderRadius: 6 }} onClick={onClose}>Cancel</Button>,
        <Button key="ok" size="small" type="primary" loading={savingLink} style={{ borderRadius: 6 }} onClick={onSave}>Save Links</Button>,
      ]}
    >
      <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 10, background: '#f0f5ff', borderRadius: 6, padding: '8px 12px' }}>
        Select resources to link. One resource can only be linked to one active process at a time. Resources already linked to another process are marked with a warning.
      </div>
      <Input.Search placeholder="Search by name or RAID…" size="small" allowClear value={linkSearch} onChange={event => setLinkSearch(event.target.value)} style={{ marginBottom: 10, fontSize: '12px' }} />
      <Spin spinning={loadingLink} tip="Loading resources…" size="small">
        {!loadingLink && allProcResources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c', fontSize: '12px' }}>
            No resources found. Upload resources in the Resource Hub.
          </div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
            {allProcResources
              .filter(resource => {
                if (!linkSearch.trim()) return true;
                const query = linkSearch.toLowerCase();
                return resource.empName.toLowerCase().includes(query) || resource.raId.toLowerCase().includes(query) || resource.piwRole.toLowerCase().includes(query);
              })
              .map(resource => {
                const isChecked = linkChecked.has(resource.id);
                const linkedElsewhere = resource.processId != null && row?.id != null && resource.processId !== row.id;
                const otherSow = linkedElsewhere ? (rows.find(item => item.id === resource.processId)?.sow || `Process #${resource.processId}`) : null;
                return (
                  <div key={resource.id} style={{ borderBottom: '1px solid #fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: isChecked ? '#f0f5ff' : '#fff' }} onClick={() => {
                      const next = new Set(linkChecked);
                      if (next.has(resource.id)) {
                        next.delete(resource.id);
                      } else {
                        next.add(resource.id);
                        setLinkDates(state => {
                          if (state[resource.id] !== undefined) return state;
                          return {
                            ...state,
                            [resource.id]: {
                              startDate: resource.engagementStartDate || '',
                              endDate: resource.engagementEndDate || '',
                            },
                          };
                        });
                      }
                      setLinkChecked(next);
                    }}>
                      <Checkbox checked={isChecked} onChange={() => {}} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>
                          {resource.empName} <span style={{ color: '#8c8c8c', fontFamily: 'monospace', fontSize: '10px' }}>({resource.raId})</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 1 }}>
                          {resource.piwRole}
                          {linkedElsewhere && <span style={{ marginLeft: 8, color: '#fa8c16', fontWeight: 500 }}>⚠ Linked to: {otherSow}</span>}
                        </div>
                      </div>
                    </div>
                    {isChecked && (
                      <div style={{ display: 'flex', gap: 8, padding: '4px 12px 8px 42px', background: '#f8f9ff' }} onClick={event => event.stopPropagation()}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Engagement Start</div>
                          <DatePicker size="small" style={{ width: '100%', fontSize: '11px' }} value={linkDates[resource.id]?.startDate ? dayjs(linkDates[resource.id].startDate) : null} disabledDate={current => {
                            const end = linkDates[resource.id]?.endDate;
                            return end ? current.isAfter(dayjs(end)) : false;
                          }} onChange={date => {
                            const value = date ? date.format('YYYY-MM-DD') : '';
                            setLinkDates(state => ({ ...state, [resource.id]: { startDate: value, endDate: state[resource.id]?.endDate || '' } }));
                          }} getPopupContainer={trigger => trigger.parentElement || document.body} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Engagement End</div>
                          <DatePicker size="small" style={{ width: '100%', fontSize: '11px' }} value={linkDates[resource.id]?.endDate ? dayjs(linkDates[resource.id].endDate) : null} disabledDate={current => {
                            const start = linkDates[resource.id]?.startDate;
                            return start ? current.isBefore(dayjs(start)) : false;
                          }} onChange={date => {
                            const value = date ? date.format('YYYY-MM-DD') : '';
                            setLinkDates(state => ({ ...state, [resource.id]: { startDate: state[resource.id]?.startDate || '', endDate: value } }));
                          }} getPopupContainer={trigger => trigger.parentElement || document.body} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Spin>
    </Modal>
  );
}
