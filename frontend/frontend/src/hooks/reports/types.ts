export type ParamType = 
    | 'month' 
    | 'date' 
    | 'datetime' 
    | 'select' 
    | 'number' 
    | 'text' 
    | 'client_id' 
    | 'fournisseur_id' 
    | 'vendeur_id'
    | 'famille_id'
    | 'checkbox' 
    | 'fields_selector';

export interface QueryParam {
    key: string;
    label: string;
    type: ParamType;
    default?: string | number | boolean;
    options?: { value: string; label: string }[];
    required?: boolean;
}

export interface QueryDefinition {
    id: string;
    name: string;
    description?: string;
    endpoint: string;
    method?: 'GET' | 'POST';
    params: QueryParam[];
    resultType: 'table' | 'cards' | 'raw';
}

export interface Client {
    id: number;
    name: string;
    phone?: string;
}

export interface Supplier {
    id: number;
    name: string;
}

export interface User {
    id: number;
    username: string;
}

export interface Famille {
    id: number;
    nom: string;
}

export interface PaginationData {
    count: number;
    next: string | null;
    previous: string | null;
}
