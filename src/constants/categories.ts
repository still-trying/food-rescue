import type { FoodCategory } from '../types/listing'

export const FOOD_CATEGORIES: readonly {
  value: FoodCategory
  label: string
}[] = [
  { value: 'cooked_meals', label: '🍛 Cooked Meals' },
  { value: 'bakery', label: '🥖 Bakery' },
  { value: 'groceries', label: '🛒 Groceries' },
  { value: 'fruits_vegetables', label: '🥦 Fruits & Vegetables' },
  { value: 'beverages', label: '🥤 Beverages' },
  { value: 'other', label: '🍱 Other' },
] as const

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((category) => [category.value, category.label])
)

export function isValidCategory(value: string): value is FoodCategory {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABEL_MAP, value)
}

export function formatCategoryLabel(category: string | null): string | null {
  if (!category) {
    return null
  }
  return CATEGORY_LABEL_MAP[category] ?? null
}

