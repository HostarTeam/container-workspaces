import { Location, Node } from '@prisma/client';

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

interface BasicCreateCTOptions {
    template: string;
    password: string;
}

export interface CreateCTByLocationOptions extends BasicCreateCTOptions {
    location: Location['id'];
}

export interface CreateCTByNodeOptions extends BasicCreateCTOptions {
    node: Node['id'];
}
