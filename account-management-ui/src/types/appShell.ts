export type EAMPage =
  | 'account_summary'
  | 'executive_summary'
  | 'executive_revenue'
  | 'executive_invoicing'
  | 'resources_info'
  | 'resources_utilization'
  | 'resources_insights'
  | 'clientmgmt_requests'
  | 'clientmgmt_connects'
  | 'information_ratecard'
  | 'information_teamhierarchy'
  | 'information_process'
  | 'user_settings'
  | 'configuration'
  | 'user_access_control';

export type EAMSection = 'account' | 'executive' | 'resources' | 'clientmgmt' | 'information' | 'configuration';

export type ActiveModule = 'home' | 'eam';
