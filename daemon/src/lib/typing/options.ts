export interface CTHardwareOptions {
    ct_cores: number;
    ct_disk: number;
    ct_ram: number;
    ct_swap: number;
}

export interface CraeteCTOptions {
    location: string;
    template: string;
    password: string;
}
