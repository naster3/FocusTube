import type { DomainTag } from "../settings/types";

export const DOMAIN_TAGS: DomainTag[] = ["intervalos", "por_semana"];

export function isDomainTag(value: string): value is DomainTag {
  return DOMAIN_TAGS.includes(value as DomainTag);
}

