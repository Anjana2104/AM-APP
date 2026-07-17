import React from 'react';
import { Space, Tabs, Tag } from 'antd';
import { BulkUploadModal } from './BulkUploadModal';
import { BeelineLinkModal } from './BeelineLinkModal';
import { ColumnVisibilityDrawer } from './ColumnVisibilityDrawer';
import { ResourceDetailDrawer } from './ResourceDetailDrawer';
import { ResourceEditModal } from './ResourceEditModal';
import ResourceResumesTab from './ResourceResumesTab';
import ResourceVerificationTab from './ResourceVerificationTab';
import { ResourceToolbar } from './ResourceToolbar';
import { openBulkUploadFilePicker } from './BulkUploadModal';
import type { UseResourceHubStateResult } from './useResourceHubState';

export function ResourceHubView({
  resources,
  fromServer,
  currentUser,
  canEdit,
  canDelete,
  activeTab,
  setActiveTab,
  filteredCount,
  globalSearch,
  setGlobalSearch,
  isFilterApplied,
  viewMode,
  setViewMode,
  showFilterPanel,
  setShowFilterPanel,
  handleClearFilters,
  setColumnDrawer,
  handleExportExcel,
  handleAddNew,
  downloadTemplate,
  handleUpload,
  handleExportBeelineMapping,
  handleClearAll,
  handleClearAllAudit,
  handleClearAllComments,
  resourceContent,
  editDrawer,
  editingResource,
  form,
  engagementOptions,
  closeEditDrawer,
  handleSaveEdit,
  detailDrawer,
  selectedResource,
  detailExpanded,
  setDetailExpanded,
  closeDetailDrawer,
  handleDetailEdit,
  handleToggleActive,
  handleNavigateToRequestFromDetail,
  handleNavigateToInsightsFromDetail,
  handleNavigateToProcessFromDetail,
  columnDrawer,
  visibleColumns,
  setVisibleColumns,
  beelineLinkModal,
  selectedBeelineId,
  savingBeeline,
  beelineRequestOptions,
  setSelectedBeelineId,
  setBeelineLinkModal,
  handleSaveBeelineLink,
  bulkUploadResult,
  setBulkUploadResult,
}: UseResourceHubStateResult) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: 0 }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ padding: '0 16px' }}
              tabBarStyle={{ marginBottom: 0, fontSize: '12px' }}
              items={[
                {
                  key: 'resources',
                  label: (
                    <span style={{ fontSize: '12px' }}>
                      Resources
                      {resources.length > 0 && <Tag color="blue" style={{ marginLeft: 6, fontSize: '10px', lineHeight: '16px', padding: '0 5px' }}>{resources.length}</Tag>}
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '16px 0' }}>
                      <ResourceToolbar
                        filteredCount={filteredCount}
                        totalCount={resources.length}
                        fromServer={fromServer}
                        globalSearch={globalSearch}
                        isFilterApplied={isFilterApplied}
                        viewMode={viewMode}
                        showFilterPanel={showFilterPanel}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        resourcesLength={resources.length}
                        onGlobalSearchChange={setGlobalSearch}
                        onClearFilters={handleClearFilters}
                        onToggleFilterPanel={() => setShowFilterPanel((prev) => !prev)}
                        onViewModeChange={setViewMode}
                        onOpenColumnDrawer={() => setColumnDrawer(true)}
                        onExportExcel={handleExportExcel}
                        onAddNew={handleAddNew}
                        onDownloadTemplate={downloadTemplate}
                        onUploadClick={() => openBulkUploadFilePicker(handleUpload)}
                        onExportBeelineMapping={handleExportBeelineMapping}
                        onDeleteAll={handleClearAll}
                        onDeleteAllAudit={handleClearAllAudit}
                        onDeleteAllComments={handleClearAllComments}
                      />
                      {resourceContent}
                    </div>
                  ),
                },
                {
                  key: 'resumes',
                  label: <span style={{ fontSize: '12px' }}>Resumes</span>,
                  children: <ResourceResumesTab />,
                },
                {
                  key: 'verification',
                  label: <span style={{ fontSize: '12px' }}>Verification</span>,
                  children: <ResourceVerificationTab resources={resources} />,
                },
              ]}
            />
          </div>
        </Space>
      </div>

      <ResourceEditModal
        open={editDrawer}
        editingResource={editingResource}
        form={form}
        engagementOptions={engagementOptions}
        onClose={closeEditDrawer}
        onSubmit={handleSaveEdit}
      />

      <ResourceDetailDrawer
        open={detailDrawer}
        resource={selectedResource}
        expanded={detailExpanded}
        canEdit={canEdit}
        canDelete={canDelete}
        currentUsername={currentUser?.username}
        onClose={closeDetailDrawer}
        onToggleExpand={() => setDetailExpanded((prev) => !prev)}
        onEdit={handleDetailEdit}
        onToggleActive={handleToggleActive}
        onNavigateToRequest={handleNavigateToRequestFromDetail}
        onNavigateToInsights={handleNavigateToInsightsFromDetail}
        onNavigateToProcess={handleNavigateToProcessFromDetail}
      />

      <ColumnVisibilityDrawer
        open={columnDrawer}
        visibleColumns={visibleColumns}
        onClose={() => setColumnDrawer(false)}
        onToggleColumn={(key, checked) => {
          const nextVisible = new Set(visibleColumns);
          if (checked) {
            nextVisible.add(key);
          } else {
            nextVisible.delete(key);
          }
          setVisibleColumns(nextVisible);
        }}
      />

      <BeelineLinkModal
        open={beelineLinkModal.open}
        resource={beelineLinkModal.resource}
        selectedBeelineId={selectedBeelineId}
        saving={savingBeeline}
        options={beelineRequestOptions}
        onChange={setSelectedBeelineId}
        onCancel={() => setBeelineLinkModal({ open: false, resource: null })}
        onSave={handleSaveBeelineLink}
      />

      <BulkUploadModal
        open={!!bulkUploadResult}
        result={bulkUploadResult}
        onClose={() => setBulkUploadResult(null)}
      />
    </div>
  );
}
