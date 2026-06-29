import type { StakeholderNetworkRecord, StakeholderNetworkType } from '../../api/stakeholderNetworkApi';

export type TeamType = StakeholderNetworkType;
export type Stakeholder = StakeholderNetworkRecord;
export type RelationshipStrength = 'strong' | 'moderate' | 'informal';
export type GraphNodePosition = { x: number; y: number };

export type StakeholderFilters = {
  teamTypes: TeamType[];
  name: string;
  title: string;
  department: string;
  reportingTo: string;
  responsibility: string;
};

export const DEPT_COLORS: Record<string, string> = {
  Engineering: '#1890ff',
  'Data Science': '#722ed1',
  Management: '#52c41a',
  DevOps: '#fa8c16',
  Product: '#eb2f96',
  QA: '#13c2c2',
  Operations: '#f5222d',
  Finance: '#2f54eb',
  Other: '#8c8c8c',
};

export function initials(name: string) {
  return name.split(' ').slice(0, 2).map(word => word[0]?.toUpperCase() || '').join('');
}

export function withSortOrder(rows: Stakeholder[], teamType: TeamType): Stakeholder[] {
  return rows.map((row, idx) => ({
    ...row,
    teamType,
    sortOrder: idx,
    reportingTo: row.reportingTo || null,
  }));
}

export function toTeamTypeLabel(teamType: TeamType): string {
  return teamType === 'client' ? 'Client' : 'Internal Team';
}

export function parseTeamTypeValue(value: unknown): TeamType {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'internal' || text === 'internal team' || text === 'ra') return 'ra';
  return 'client';
}

export function searchableStakeholderText(row: Stakeholder): string {
  return [
    row.name,
    row.title,
    row.department,
    row.email,
    row.phone || '',
    row.responsibility,
    toTeamTypeLabel(row.teamType),
  ].join(' ').toLowerCase();
}

export function relationshipStyle(strength: RelationshipStrength) {
  if (strength === 'strong') {
    return { stroke: '#2f54eb', strokeWidth: 2.6, strokeDasharray: undefined as string | undefined };
  }
  if (strength === 'moderate') {
    return { stroke: '#4c7cf3', strokeWidth: 2.2, strokeDasharray: '7 6' };
  }
  return { stroke: '#9ab3f5', strokeWidth: 1.9, strokeDasharray: '2.5 4' };
}

export function computeTreeLayoutPositions(
  expandedIds: Set<string>,
  visibleById: Record<string, Stakeholder>,
  reportsByManagerId: Record<string, Stakeholder[]>,
  preferredRoots: string[]
): Record<string, GraphNodePosition> {
  const visibleIds = Array.from(expandedIds).filter(id => Boolean(visibleById[id]));
  if (!visibleIds.length) return {};

  const idSet = new Set(visibleIds);
  const NODE_GAP_X = 230;
  const LEVEL_GAP_Y = 210;
  const TOP_Y = 120;
  const CANVAS_CENTER_X = 380;

  const childrenFor = (id: string, within?: Set<string>) =>
    (reportsByManagerId[id] || [])
      .map(child => child.id)
      .filter(childId => idSet.has(childId) && (!within || within.has(childId)))
      .sort((a, b) => {
        const aNode = visibleById[a];
        const bNode = visibleById[b];
        if (!aNode || !bNode) return 0;
        if (aNode.sortOrder !== bNode.sortOrder) return aNode.sortOrder - bNode.sortOrder;
        return aNode.name.localeCompare(bNode.name);
      });

  const derivedRoots = visibleIds.filter(id => {
    const parentId = visibleById[id]?.reportingTo;
    return !parentId || !idSet.has(parentId);
  });
  const orderedRoots = [
    ...preferredRoots.filter(id => idSet.has(id)),
    ...derivedRoots.filter(id => !preferredRoots.includes(id)),
    ...visibleIds.filter(id => !preferredRoots.includes(id) && !derivedRoots.includes(id)),
  ].filter((id, idx, arr) => arr.indexOf(id) === idx);

  const globallyAssigned = new Set<string>();
  const positioned: Record<string, GraphNodePosition> = {};
  const subtreeNodeIdsByRoot: Record<string, Set<string>> = {};
  const localPositionsByRoot: Record<string, Record<string, GraphNodePosition>> = {};
  const subtreeBoundsByRoot: Record<string, { minX: number; maxX: number }> = {};

  const collectSubtree = (rootId: string) => {
    const collected = new Set<string>();
    const walk = (id: string, path: Set<string>) => {
      if (!idSet.has(id) || collected.has(id) || path.has(id)) return;
      collected.add(id);
      const nextPath = new Set(path);
      nextPath.add(id);
      childrenFor(id).forEach(childId => walk(childId, nextPath));
    };
    walk(rootId, new Set());
    return collected;
  };

  orderedRoots.forEach(rootId => {
    if (!idSet.has(rootId) || globallyAssigned.has(rootId)) return;
    const subtreeIds = collectSubtree(rootId);
    if (!subtreeIds.size) return;
    subtreeIds.forEach(id => globallyAssigned.add(id));
    subtreeNodeIdsByRoot[rootId] = subtreeIds;

    let leafIndex = 0;
    const local: Record<string, GraphNodePosition> = {};
    const layoutNode = (id: string, depth: number, path: Set<string>) => {
      if (path.has(id)) return;
      const nextPath = new Set(path);
      nextPath.add(id);
      const children = childrenFor(id, subtreeIds).filter(childId => !nextPath.has(childId));
      if (!children.length) {
        local[id] = { x: leafIndex * NODE_GAP_X, y: TOP_Y + (depth * LEVEL_GAP_Y) };
        leafIndex += 1;
        return;
      }
      children.forEach(childId => layoutNode(childId, depth + 1, nextPath));
      const childXs = children.map(childId => local[childId]?.x).filter((x): x is number => typeof x === 'number');
      const fallbackX = leafIndex * NODE_GAP_X;
      const x = childXs.length ? (Math.min(...childXs) + Math.max(...childXs)) / 2 : fallbackX;
      if (!childXs.length) leafIndex += 1;
      local[id] = { x, y: TOP_Y + (depth * LEVEL_GAP_Y) };
    };

    layoutNode(rootId, 0, new Set());
    localPositionsByRoot[rootId] = local;
    const xs = Object.values(local).map(point => point.x);
    subtreeBoundsByRoot[rootId] = {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
    };
  });

  const effectiveRoots = Object.keys(localPositionsByRoot);
  if (!effectiveRoots.length) return {};

  const rootSpacing = 300;
  const firstRootCenter = CANVAS_CENTER_X - ((effectiveRoots.length - 1) * rootSpacing) / 2;
  effectiveRoots.forEach((rootId, idx) => {
    const local = localPositionsByRoot[rootId];
    const subtreeIds = subtreeNodeIdsByRoot[rootId];
    const targetRootX = firstRootCenter + (idx * rootSpacing);
    const localRootX = local[rootId]?.x ?? 0;
    const shiftX = targetRootX - localRootX;
    const bounds = subtreeBoundsByRoot[rootId];
    const halfWidth = Math.max(80, (bounds.maxX - bounds.minX) / 2);
    subtreeIds.forEach(id => {
      const point = local[id];
      if (!point) return;
      const shiftedX = point.x + shiftX;
      if (!positioned[id]) {
        positioned[id] = { x: shiftedX, y: point.y };
      }
    });
    if (effectiveRoots.length > 1 && halfWidth > 0) {
      const minAllowed = firstRootCenter + (idx * rootSpacing) - halfWidth;
      const maxAllowed = firstRootCenter + (idx * rootSpacing) + halfWidth;
      subtreeIds.forEach(id => {
        const point = positioned[id];
        if (!point) return;
        point.x = Math.max(minAllowed, Math.min(maxAllowed, point.x));
      });
    }
  });

  return positioned;
}

export function buildUploadedRowsMerged(
  sourceRows: Record<string, any>[],
  existingRows: Stakeholder[]
): Stakeholder[] {
  const existingNameToId: Record<string, string> = {};
  existingRows.forEach(row => {
    existingNameToId[`${row.teamType}::${row.name.trim().toLowerCase()}`] = row.id;
  });

  const incoming = sourceRows
    .map((row, index) => {
      const teamType = parseTeamTypeValue(row['Team Type']);
      return {
        id: `${teamType}_${Date.now()}_${index}`,
        teamType,
        name: String(row['Name'] || '').trim(),
        title: String(row['Title / Role'] || '').trim(),
        department: String(row['Department'] || '').trim(),
        reportingTo: null,
        email: String(row['Email'] || '').trim(),
        phone: String(row['Phone Number'] || row['Phone'] || '').trim(),
        responsibility: String(row['Responsibility'] || '').trim(),
        sortOrder: existingRows.length + index,
      } as Stakeholder;
    })
    .filter(row => row.name);

  const combinedMap: Record<string, string> = { ...existingNameToId };
  incoming.forEach(row => {
    combinedMap[`${row.teamType}::${row.name.toLowerCase()}`] = row.id;
  });

  return incoming.map((row, index) => {
    const managerName = String(sourceRows[index]['Reporting Manager Name'] || '').trim().toLowerCase();
    const managerTeamType = parseTeamTypeValue(sourceRows[index]['Reporting Team Type'] || sourceRows[index]['Team Type']);
    const scopedKey = `${managerTeamType}::${managerName}`;
    const globalFallback = Object.keys(combinedMap).find(key => key.endsWith(`::${managerName}`));
    return {
      ...row,
      reportingTo: managerName ? (combinedMap[scopedKey] || (globalFallback ? combinedMap[globalFallback] : null)) : null,
    };
  });
}
