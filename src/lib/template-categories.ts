/** Canonical template categories (dashboard tabs + admin). Keep in sync everywhere. */
export const TEMPLATE_CATEGORIES = [
  'Picha Kiofisi',
  'Boresha',
  'Kabati ya Nguo',
  'Creativity',
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export function isTemplateCategory(v: string): v is TemplateCategory {
  return (TEMPLATE_CATEGORIES as readonly string[]).includes(v);
}
