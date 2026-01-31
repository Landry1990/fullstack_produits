export const DiscountType = {
    PERCENTAGE: 'PERCENTAGE',
    FIXED_AMOUNT: 'FIXED_AMOUNT',
    BUY_X_GET_Y: 'BUY_X_GET_Y',
    BUNDLE: 'BUNDLE'
} as const;

export type DiscountType = typeof DiscountType[keyof typeof DiscountType];

export const ApplicationMode = {
    AUTO_SHOW: 'AUTO_SHOW',
    AUTO_SUGGEST: 'AUTO_SUGGEST',
    AUTO_APPLY: 'AUTO_APPLY'
} as const;

export type ApplicationMode = typeof ApplicationMode[keyof typeof ApplicationMode];

export interface PromotionPackItem {
    product: number;
    product_name?: string;
    quantity: number;
}

export interface Promotion {
    id: number;
    name: string;
    description?: string;
    start_date: string;
    end_date?: string;
    active: boolean;
    discount_type: DiscountType;
    application_mode: ApplicationMode;
    value: number; // Percentage or Amount or Bundle Price
    buy_quantity: number;
    get_quantity: number;
    priority: number;
    products?: number[]; // IDs for regular promos
    pack_items?: PromotionPackItem[]; // Items for Bundle
    products_count?: number;
    rayons_count?: number;
    created_at?: string;
}
