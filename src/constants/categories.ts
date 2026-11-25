import type {
  DietaryType,
  FoodCategory,
  StorageType,
} from '../types/listing'

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

export const DIETARY_OPTIONS: readonly {
  value: DietaryType
  label: string
}[] = [
  { value: 'veg', label: '🟢 Vegetarian' },
  { value: 'vegan', label: '🌱 Vegan' },
  { value: 'eggetarian', label: '🥚 Eggetarian' },
  { value: 'non_veg', label: '🍗 Non-Vegetarian' },
] as const

export const STORAGE_OPTIONS: readonly {
  value: StorageType
  label: string
}[] = [
  { value: 'hot', label: '🔥 Keep Hot' },
  { value: 'refrigerated', label: '❄️ Refrigerated' },
  { value: 'room_temp', label: '🌡️ Room Temp' },
  { value: 'frozen', label: '🧊 Frozen' },
] as const

export const COMMON_ALLERGENS: readonly string[] = [
  'Dairy',
  'Nuts',
  'Gluten',
  'Soy',
  'Eggs',
  'Shellfish',
] as const

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((category) => [category.value, category.label])
)

const DIETARY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  DIETARY_OPTIONS.map((item) => [item.value, item.label])
)

const STORAGE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  STORAGE_OPTIONS.map((item) => [item.value, item.label])
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

export function formatDietaryLabel(
  dietary: DietaryType | null | undefined
): string | null {
  if (!dietary) return null
  return DIETARY_LABEL_MAP[dietary] ?? null
}

export function formatStorageLabel(
  storage: StorageType | null | undefined
): string | null {
  if (!storage) return null
  return STORAGE_LABEL_MAP[storage] ?? null
}
