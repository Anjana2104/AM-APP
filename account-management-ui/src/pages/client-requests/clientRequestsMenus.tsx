import React from 'react';
import { Modal } from 'antd';
import type { MenuProps } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, LinkOutlined, PlusOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons';

type RequestLike = { isActive?: boolean };

type ToolbarMenuParams = {
  canEdit: boolean;
  canDelete: boolean;
  hasRequests: boolean;
  onAddNew: () => void;
  onDownloadTemplate: () => void;
  onUploadRequests: () => void;
  onDeleteAllRequests: () => void;
  onDeleteAllAudit: () => void;
  onDeleteAllComments: () => void;
};

export function buildClientRequestsToolbarMenuItems(params: ToolbarMenuParams): MenuProps['items'] {
  const {
    canEdit,
    canDelete,
    hasRequests,
    onAddNew,
    onDownloadTemplate,
    onUploadRequests,
    onDeleteAllRequests,
    onDeleteAllAudit,
    onDeleteAllComments,
  } = params;

  return [
    ...(canEdit ? [{
      key: 'add',
      label: <span style={{ fontSize: '11px' }}>Add New Request</span>,
      icon: <PlusOutlined style={{ fontSize: '11px' }} />,
      onClick: onAddNew,
    }] : []),
    { type: 'divider' as const },
    {
      key: 'dlTemplate',
      label: <span style={{ fontSize: '11px' }}>Download Template</span>,
      icon: <DownloadOutlined style={{ fontSize: '11px' }} />,
      onClick: onDownloadTemplate,
    },
    ...(canEdit ? [{
      key: 'ulRequest',
      label: <span style={{ fontSize: '11px' }}>Upload Requests</span>,
      icon: <UploadOutlined style={{ fontSize: '11px' }} />,
      onClick: onUploadRequests,
    }] : []),
    ...(canDelete && hasRequests ? [
      { type: 'divider' as const },
      {
        key: 'deleteAll',
        label: <span style={{ fontSize: '11px' }}>Delete All Requests</span>,
        icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
        danger: true,
        onClick: () => Modal.confirm({
          title: 'Delete all requests?',
          content: 'This will permanently delete all request data from the database.',
          okText: 'Yes, delete all',
          cancelText: 'Cancel',
          okButtonProps: { danger: true, size: 'small' },
          onOk: onDeleteAllRequests,
        }),
      },
    ] : []),
    ...(canDelete ? [
      { type: 'divider' as const },
      {
        key: 'deleteAllAudit',
        label: <span style={{ fontSize: '11px' }}>Delete All Audit History</span>,
        icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
        danger: true,
        onClick: () => Modal.confirm({
          title: 'Delete all request audit history?',
          content: 'This will permanently remove all audit log entries for requests.',
          okText: 'Yes, delete all',
          cancelText: 'Cancel',
          okButtonProps: { danger: true, size: 'small' },
          onOk: onDeleteAllAudit,
        }),
      },
      {
        key: 'deleteAllComments',
        label: <span style={{ fontSize: '11px' }}>Delete All Comments</span>,
        icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
        danger: true,
        onClick: () => Modal.confirm({
          title: 'Delete all request comments?',
          content: 'This will permanently remove all comments across all request records.',
          okText: 'Yes, delete all',
          cancelText: 'Cancel',
          okButtonProps: { danger: true, size: 'small' },
          onOk: onDeleteAllComments,
        }),
      },
    ] : []),
  ];
}

type CardMenuParams<T extends RequestLike> = {
  request: T;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (request: T) => void;
  onLinkResources: (request: T) => void;
  onToggleActive: (request: T) => void;
  onDelete: (request: T) => void;
};

export function buildClientRequestCardMenuItems<T extends RequestLike>(params: CardMenuParams<T>): MenuProps['items'] {
  const { request, canEdit, canDelete, onEdit, onLinkResources, onToggleActive, onDelete } = params;
  return [
    canEdit ? {
      key: 'edit',
      label: <span style={{ fontSize: '11px' }}>Edit</span>,
      icon: <EditOutlined style={{ fontSize: '11px' }} />,
      onClick: () => onEdit(request),
    } : null,
    {
      key: 'linkResources',
      label: <span style={{ fontSize: '11px' }}>Link Resources</span>,
      icon: <LinkOutlined style={{ fontSize: '11px' }} />,
      onClick: () => onLinkResources(request),
    },
    canEdit ? {
      key: 'toggleActive',
      label: <span style={{ fontSize: '11px' }}>{request.isActive === false ? 'Mark Active' : 'Mark Inactive'}</span>,
      icon: request.isActive === false
        ? <CheckCircleOutlined style={{ fontSize: '11px', color: '#52c41a' }} />
        : <StopOutlined style={{ fontSize: '11px', color: '#fa8c16' }} />,
      onClick: () => onToggleActive(request),
    } : null,
    canDelete ? {
      key: 'delete',
      label: <span style={{ fontSize: '11px' }}>Delete</span>,
      icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
      danger: true,
      onClick: () => onDelete(request),
    } : null,
  ].filter(Boolean) as MenuProps['items'];
}
