export interface User {
    id?: number;
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    is_superuser: boolean;
    token?: string;
    allowed_menus?: string[];
    server_time?: string;

    // Profile nested object (backend structure)
    profile?: {
        role?: string;
        allowed_menus?: string[];
        can_do_returns?: boolean;
        can_sell_negative_stock?: boolean;
        can_cash_out?: boolean;
        can_delete_product?: boolean;
        can_adjust_stock?: boolean;
        can_delete_fournisseur?: boolean;
        can_delete_commande?: boolean;
        can_close_commande?: boolean;
        can_generate_coupon?: boolean;
        can_modify_price?: boolean;
        max_discount_rate?: number;
    };

    // Legacy flat permissions
    can_do_returns?: boolean;
    can_sell_negative_stock?: boolean;
    can_cash_out?: boolean;
    can_delete_product?: boolean;
    can_adjust_stock?: boolean;
    can_delete_commande?: boolean;
    can_close_commande?: boolean;
    can_delete_fournisseur?: boolean;
    can_generate_coupon?: boolean;
}

export interface SudoOptions {
    title?: string;
    message?: string;
    permission?: string;
}

export interface SudoState {
    isOpen: boolean;
    onValidate: (validatorId: number, password: string) => Promise<void>;
    title?: string;
    message?: string;
    permission?: string;
}
