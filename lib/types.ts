export type Plot = {
    id: number;
    signature: string;
    plotNumber: string;
    status: string;
    area_sqyds: number;
    dimensions: string | null;
    dim_top: string | null;
    dim_right: string | null;
    dim_bottom: string | null;
    dim_left: string | null;
    facing: string | null;
    price_per_sqyd: number | null;
    notes: string | null;
    contact_role: string | null;
    contact_name: string | null;
    contact_number: string | null;
    show_info_publicly: boolean;
    show_price_publicly: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    createdAt: string; // ISO String from API
    updatedAt: string; // ISO String from API
};
