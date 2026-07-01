import type { ConfigType } from '../context/ConfigContext';

export type ConfigSelectOption = {
  value: string;
  label: string;
};

export function getLinkedConfigLabelOptions(
  configs: ConfigType[],
  linkTargetId: string,
  consumerLabel: string,
): ConfigSelectOption[] {
  const linkedConfig = configs.find((config) => config.linkedTo?.includes(linkTargetId));
  if (!linkedConfig) return [];

  if (!Array.isArray(linkedConfig.items)) {
    console.error(
      `[${consumerLabel}] Linked config "${linkedConfig.id}" for "${linkTargetId}" has an invalid items payload.`,
      linkedConfig,
    );
    return [];
  }

  return linkedConfig.items
    .filter((item) => typeof item?.label === 'string' && item.label.trim().length > 0)
    .map((item) => ({ value: item.label, label: item.label }));
}
