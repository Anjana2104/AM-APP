/**
 * EngagementMapping.tsx
 *
 * Engagement Mapping ? Visual drag-and-drop interface for resource allocation
 * and project engagement tracking with Kanban-style cards
 * UI Location: Account Operations > Resources > Engagement Mapping
 * Page ID: resources_utilization
 */
import { EngagementMappingView } from './engagement-mapping/EngagementMappingView';
import type { ResourceUtilizationProps } from './engagement-mapping/types';
import { useEngagementMappingState } from './engagement-mapping/useEngagementMappingState';

export function EngagementMapping(props: ResourceUtilizationProps) {
  const state = useEngagementMappingState(props);
  return <EngagementMappingView {...state} />;
}
