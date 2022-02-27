/**
 * This interface is used to represent the hardware options in the configuration in the database
 * @interface
 */
export interface CTHardwareOptions {
    ct_cores: number;
    ct_disk: number;
    ct_ram: number;
    ct_swap: number;
}

/**
 * This interface is used to represent the options used to create a container
 * @interface
 */
export interface CreateCTOptions {
    location: string;
    template: string;
    password: string;
}
