import type { ResourceAllocationEntry, ResourceRow } from '../types/resource';

export const PIPELINE_STAGES = ['Shortlisted', 'Offered', 'Selected', 'Joined'] as const;

type AllocationLike = Partial<ResourceAllocationEntry> & Record<string, unknown>;

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toAllocationNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(200, parsed));
}

export function normalizeEngagementNameKey(value: unknown): string {
  return toText(value).toLowerCase().replace(/\s+/g, '');
}

function cleanEntry(entry: AllocationLike): ResourceAllocationEntry | null {
  const engagementName = toText(entry.engagementName ?? entry.engagement ?? entry.project);
  const allocationPercentage = toAllocationNumber(entry.allocationPercentage ?? entry.allocationPct ?? entry.percentage);
  if (!engagementName && allocationPercentage <= 0) return null;
  return {
    engagementName,
    allocationPercentage,
    engagementStartDate: toText(entry.engagementStartDate),
    engagementEndDate: toText(entry.engagementEndDate),
    allocationStatus: toText(entry.allocationStatus),
    beelineId: toText(entry.beelineId),
  };
}

function mergeAllocationEntries(entries: ResourceAllocationEntry[]): ResourceAllocationEntry[] {
  const merged: ResourceAllocationEntry[] = [];
  const indexByKey = new Map<string, number>();

  entries.forEach((entry) => {
    const key = normalizeEngagementNameKey(entry.engagementName);
    if (!key) {
      merged.push(entry);
      return;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(entry);
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      engagementName: entry.engagementName || existing.engagementName,
      allocationPercentage: entry.allocationPercentage,
      engagementStartDate: entry.engagementStartDate || existing.engagementStartDate,
      engagementEndDate: entry.engagementEndDate || existing.engagementEndDate,
      allocationStatus: entry.allocationStatus || existing.allocationStatus,
      beelineId: entry.beelineId || existing.beelineId,
    };
  });

  return merged;
}

export function parseAllocationEntries(raw: unknown): ResourceAllocationEntry[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return mergeAllocationEntries(
    parsed
      .map((entry) => cleanEntry((entry || {}) as AllocationLike))
      .filter((entry): entry is ResourceAllocationEntry => !!entry)
  );
}

export function ensureAllocationEntries(resource: Partial<ResourceRow>): ResourceAllocationEntry[] {
  if (Array.isArray(resource.allocationEntries) && resource.allocationEntries.length > 0) {
    return mergeAllocationEntries(
      resource.allocationEntries
        .map((entry) => cleanEntry((entry || {}) as AllocationLike))
        .filter((entry): entry is ResourceAllocationEntry => !!entry)
    );
  }

  const engagementName = toText(resource.engagement);
  const allocationPercentage = toAllocationNumber(resource.allocationPercentage);
  if (!engagementName && allocationPercentage <= 0) return [];
  return mergeAllocationEntries([
    {
      engagementName,
      allocationPercentage,
      engagementStartDate: toText(resource.engagementStartDate),
      engagementEndDate: toText(resource.engagementEndDate),
      allocationStatus: toText(resource.allocationStatus),
      beelineId: toText(resource.beelineId),
    },
  ]);
}

export function totalAllocationPercentage(entries: ResourceAllocationEntry[]): number {
  const total = entries.reduce((sum, entry) => sum + toAllocationNumber(entry.allocationPercentage), 0);
  return Math.round(total * 100) / 100;
}

export function primaryAllocationEntry(entries: ResourceAllocationEntry[]): ResourceAllocationEntry | null {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => b.allocationPercentage - a.allocationPercentage)[0];
}

export function deriveAllocationStatus(entries: ResourceAllocationEntry[], explicitStatus?: string): string {
  const normalizedExplicit = toText(explicitStatus);
  if (normalizedExplicit && (PIPELINE_STAGES as readonly string[]).includes(normalizedExplicit)) {
    return normalizedExplicit;
  }

  const hasBench = entries.some((entry) => normalizeEngagementNameKey(entry.engagementName) === 'bench');
  if (hasBench) return 'Available';

  const total = totalAllocationPercentage(entries);
  if (total <= 0 || total < 100) return 'Available';

  // Fully or over-allocated with no explicit pipeline status: preserve existing or default Joined
  return normalizedExplicit || 'Joined';
}