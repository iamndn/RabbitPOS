// Standard Vietnamese F&B Recipe Templates for RabbitPOS
// Helps shop owners populate BOM (Bill of Materials) recipes with 1-click

import { Ingredient } from '@/types/purchase';

export interface RecipeTemplateItem {
  ingredientNameKeyword: string; // Keyword to match against existing ingredients (e.g. 'cà phê', 'sữa đặc')
  defaultName: string;          // Fallback name if ingredient not found
  category: string;             // 'ingredient' | 'fruit' | 'packaging' | 'other'
  usageQuantity: number;        // Quantity in baseUnit (e.g. 50 ml, 30 g)
  baseUnit: string;             // 'ml', 'g', 'cái'
  note?: string;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  description: string;
  items: RecipeTemplateItem[];
}

export const POPULAR_RECIPE_TEMPLATES: RecipeTemplate[] = [
  {
    id: 'cf-den-da',
    name: 'Cà Phê Đen Đá',
    category: 'Cà phê',
    keywords: ['đen', 'black', 'espresso', 'phin', 'đen đá', 'cà phê đen'],
    description: '50ml cốt cà phê Robusta + 15ml nước đường + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'cà phê',
        defaultName: 'Cốt Cà Phê / Hạt Robusta',
        category: 'ingredient',
        usageQuantity: 50,
        baseUnit: 'ml',
        note: 'Tương đương 25g cà phê hạt',
      },
      {
        ingredientNameKeyword: 'đường',
        defaultName: 'Nước Đường / Đường cát',
        category: 'ingredient',
        usageQuantity: 15,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'cf-sua-da',
    name: 'Cà Phê Sữa Đá',
    category: 'Cà phê',
    keywords: ['sữa đá', 'nâu đá', 'cà phê sữa', 'cafe sữa', 'cf sữa'],
    description: '50ml cốt cà phê + 30ml sữa đặc + 10ml sữa tươi + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'cà phê',
        defaultName: 'Cốt Cà Phê / Hạt Robusta',
        category: 'ingredient',
        usageQuantity: 50,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa đặc',
        defaultName: 'Sữa Đặc (Ngôi Sao / Ông Thọ)',
        category: 'ingredient',
        usageQuantity: 30,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa tươi',
        defaultName: 'Sữa Tươi Thanh Trùng',
        category: 'ingredient',
        usageQuantity: 10,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'bac-xiu',
    name: 'Bạc Xỉu (Nhiều sữa ít cà phê)',
    category: 'Cà phê',
    keywords: ['bạc xỉu', 'bac xiu', 'white coffee'],
    description: '30ml cốt cà phê + 40ml sữa đặc + 80ml sữa tươi + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'cà phê',
        defaultName: 'Cốt Cà Phê',
        category: 'ingredient',
        usageQuantity: 30,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa đặc',
        defaultName: 'Sữa Đặc',
        category: 'ingredient',
        usageQuantity: 40,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa tươi',
        defaultName: 'Sữa Tươi',
        category: 'ingredient',
        usageQuantity: 80,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'tra-dao-cam-sa',
    name: 'Trà Đào Cam Sả',
    category: 'Trà & Trà sữa',
    keywords: ['đào', 'cam sả', 'trà đào', 'peach'],
    description: '120ml cốt trà + 30ml syrup đào + 20ml nước cam + 2 miếng đào ngâm',
    items: [
      {
        ingredientNameKeyword: 'trà',
        defaultName: 'Cốt Trà Đen / Trà Earl Grey',
        category: 'ingredient',
        usageQuantity: 120,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'syrup đào',
        defaultName: 'Syrup Đào (Monin / Teisseire / Torani)',
        category: 'ingredient',
        usageQuantity: 30,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'cam',
        defaultName: 'Cam Sành Tươi (Lát/Nước)',
        category: 'fruit',
        usageQuantity: 30,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'đào ngâm',
        defaultName: 'Đào Ngâm Hộp',
        category: 'ingredient',
        usageQuantity: 2,
        baseUnit: 'miếng',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'tra-sua-tran-chau',
    name: 'Trà Sữa Trân Châu',
    category: 'Trà & Trà sữa',
    keywords: ['trà sữa', 'milktea', 'trân châu', 'boba'],
    description: '150ml cốt trà đen + 30g bột béo + 20ml sữa đặc + 50g trân châu',
    items: [
      {
        ingredientNameKeyword: 'trà',
        defaultName: 'Cốt Trà Đen',
        category: 'ingredient',
        usageQuantity: 150,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'bột béo',
        defaultName: 'Bột Kem Béo (Non-dairy Creamer)',
        category: 'ingredient',
        usageQuantity: 30,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'sữa đặc',
        defaultName: 'Sữa Đặc',
        category: 'ingredient',
        usageQuantity: 20,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'trân châu',
        defaultName: 'Trân Châu Đen Nấu Sẵn',
        category: 'ingredient',
        usageQuantity: 50,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút Trân Châu',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'nuoc-ep-cam',
    name: 'Nước Ép Cam Tươi',
    category: 'Nước ép tươi',
    keywords: ['cam', 'orange', 'ép cam', 'cam vắt', 'cam tươi'],
    description: '250g cam sành tươi (hao hụt 15% vỏ) + 15ml nước đường + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'cam',
        defaultName: 'Cam Sành Tươi',
        category: 'fruit',
        usageQuantity: 250,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'đường',
        defaultName: 'Nước Đường',
        category: 'ingredient',
        usageQuantity: 15,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'nuoc-ep-tao-dua',
    name: 'Nước Ép Táo Dứa',
    category: 'Nước ép tươi',
    keywords: ['táo', 'dứa', 'thơm', 'apple', 'pineapple'],
    description: '150g táo xanh + 120g dứa tươi + 10ml nước đường + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'táo',
        defaultName: 'Táo Xanh / Táo Envy',
        category: 'fruit',
        usageQuantity: 150,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'dứa',
        defaultName: 'Dứa / Thơm Tươi',
        category: 'fruit',
        usageQuantity: 120,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'nuoc-ep-oi-hong',
    name: 'Nước Ép Ổi Hồng',
    category: 'Nước ép tươi',
    keywords: ['ổi', 'ổi hồng', 'guava'],
    description: '250g ổi hồng tươi + 15ml nước đường + 5ml cốt chanh + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'ổi',
        defaultName: 'Ổi Hồng Tươi',
        category: 'fruit',
        usageQuantity: 250,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'đường',
        defaultName: 'Nước Đường',
        category: 'ingredient',
        usageQuantity: 15,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'chanh',
        defaultName: 'Cốt Chanh Tươi',
        category: 'fruit',
        usageQuantity: 5,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'sinh-to-bo',
    name: 'Sinh Tố Bơ Sáp',
    category: 'Nước ép tươi',
    keywords: ['bơ', 'avocado', 'sinh tố bơ'],
    description: '150g bơ sáp (hao hụt 15%) + 40ml sữa đặc + 60ml sữa tươi + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'bơ',
        defaultName: 'Bơ Sáp Đắk Lắk',
        category: 'fruit',
        usageQuantity: 150,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'sữa đặc',
        defaultName: 'Sữa Đặc',
        category: 'ingredient',
        usageQuantity: 40,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa tươi',
        defaultName: 'Sữa Tươi Thanh Trùng',
        category: 'ingredient',
        usageQuantity: 60,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút To',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'tra-chanh-tac',
    name: 'Trà Chanh / Trà Tắc',
    category: 'Trà & Trà sữa',
    keywords: ['chanh', 'tắc', 'quất', 'lemon tea'],
    description: '150ml cốt trà lài + 20ml cốt chanh/tắc + 35ml nước đường + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'trà',
        defaultName: 'Cốt Trà Lài / Trà Xanh',
        category: 'ingredient',
        usageQuantity: 150,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'chanh',
        defaultName: 'Cốt Chanh / Tắc Tươi',
        category: 'fruit',
        usageQuantity: 20,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'đường',
        defaultName: 'Nước Đường',
        category: 'ingredient',
        usageQuantity: 35,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
  {
    id: 'matcha-latte',
    name: 'Matcha Latte / Đá Xay',
    category: 'Đá xay',
    keywords: ['matcha', 'trà xanh', 'greentea'],
    description: '5g bột matcha Nhật + 120ml sữa tươi + 20ml sữa đặc + 10ml nước đường + 1 bộ ly',
    items: [
      {
        ingredientNameKeyword: 'matcha',
        defaultName: 'Bột Matcha Nhật',
        category: 'ingredient',
        usageQuantity: 5,
        baseUnit: 'g',
      },
      {
        ingredientNameKeyword: 'sữa tươi',
        defaultName: 'Sữa Tươi',
        category: 'ingredient',
        usageQuantity: 120,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'sữa đặc',
        defaultName: 'Sữa Đặc',
        category: 'ingredient',
        usageQuantity: 20,
        baseUnit: 'ml',
      },
      {
        ingredientNameKeyword: 'ly',
        defaultName: 'Bộ Ly Nhựa + Nắp Cầu + Ống Hút',
        category: 'packaging',
        usageQuantity: 1,
        baseUnit: 'cái',
      },
    ],
  },
];

/**
 * Finds the most relevant recipe template matching a given product name
 */
export function findMatchingRecipeTemplate(
  productName: string,
  categoryName?: string
): RecipeTemplate | null {
  const pName = (productName || '').toLowerCase().trim();
  const catName = (categoryName || '').toLowerCase().trim();

  // 1. Direct keyword match in product name
  for (const t of POPULAR_RECIPE_TEMPLATES) {
    for (const kw of t.keywords) {
      if (pName.includes(kw.toLowerCase())) {
        return t;
      }
    }
  }

  // 2. Fallback to category match if any
  for (const t of POPULAR_RECIPE_TEMPLATES) {
    if (t.category.toLowerCase() === catName) {
      return t;
    }
  }

  return null;
}

/**
 * Maps a template's items to available ingredients in the database
 * Returns lines formatted for the recipe editor: { ingredient_id, usage_quantity }
 */
export function mapTemplateToIngredients(
  template: RecipeTemplate,
  availableIngredients: Ingredient[]
): { ingredient_id: number; usage_quantity: number; fallbackName: string }[] {
  return template.items.map((item) => {
    // Try to find matching ingredient in available ingredients
    const keyword = item.ingredientNameKeyword.toLowerCase().trim();
    const matched = availableIngredients.find((ing) => {
      const ingName = ing.name.toLowerCase().trim();
      return ingName.includes(keyword) || keyword.includes(ingName);
    });

    return {
      ingredient_id: matched ? matched.id : availableIngredients[0]?.id || 0,
      usage_quantity: item.usageQuantity,
      fallbackName: matched ? matched.name : item.defaultName,
    };
  });
}
