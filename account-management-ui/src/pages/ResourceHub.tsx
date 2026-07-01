/**
 * ResourceHub.tsx
 *
 * Resource Hub — Comprehensive resource management with skills, roles,
 * allocation tracking, and detailed resource profiles
 * UI Location: Account Operations > Resources > Resource Hub
 * Page ID: resources_info
 */
import React from 'react';
import { ResourceHubView } from './resource/ResourceHubView';
import type { ResourceHubProps } from './resource/resourceTypes';
import { useResourceHubState } from './resource/useResourceHubState';

export type { ResourceRow } from '../types/resource';

const ResourceHub: React.FC<ResourceHubProps> = (props) => {
  const state = useResourceHubState(props);
  return <ResourceHubView {...state} />;
};

export default ResourceHub;
