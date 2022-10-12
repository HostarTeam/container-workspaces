import MessageRouting from '../ws/routing/MessageRouting';
import { CTHardwareOptions } from './options';

/**
 * This interface is used to define the configuration file structure
 */
export interface Configuration {
    listenAddress: string;
    listenPort: number;
    listenWssPort: number;
    remoteAddress: string;
    remotePort: number;
    remoteWssPort: number;
    sslOptions?: {
        cert: string;
        key: string;
    };
    protocol: 'http' | 'https';
    proxy: ProxyConfiguration;
    database: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    pve: {
        hostname: string;
        protocol: Configuration['protocol'];
        username: string;
        password: string;
    };
}

export interface ProxyConfiguration {
    listenAddress: string;
    listenPort: number;
    remoteAddress: string;
    remotePort: number;
    wildcardBaseAddress: string;
    protocol: 'http' | 'https';
    sslOptions?: {
        cert: string;
        key: string;
    };
}

export type httpProtocol = 'http' | 'https';

/**
 * This interface is used to define a node in the PVE api
 */
export interface Node {
    node: string;
    status: 'unknown' | 'online' | 'offline';
    cpu: number;
    level: string;
    maxcpu: number;
    maxmem: number;
    mem: number;
    disk: number;
    maxdisk: number;
    ssl_fingerprint: string;
    uptime: number;
    type: string;
}

/**
 * This interface is used to define an error report when a command is not working
 */
export interface CommandError {
    command: string;
    stderr: string;
    stdout: string;
    exitCode: number;
    stack: string;
    message: string;
}

export type MessageRoutingHandler = MessageRouting[keyof MessageRouting];

export type ResponseContainer = ContainerStatus & {
    ip: string;
    ready: boolean;
};

/**
 * This interface is used to define an LXC container in the PVE api
 */
export interface LXC {
    ostemplate: string;
    vmid: number;
    arch?: 'amd64' | 'i386' | 'arm64' | 'armhf';
    bwlimit?: number;
    cmode?: 'shell' | 'console' | 'tty';
    console?: boolean;
    cores?: number;
    cpulimit?: number;
    cpuunits?: number;
    debug?: boolean;
    description?: string;
    features?: string;
    force?: boolean;
    hookscript?: string;
    hostname?: string;
    'ignore-unpack-errors'?: boolean;
    lock?:
        | 'backup'
        | 'create'
        | 'destroyed'
        | 'disk'
        | 'fstrim'
        | 'migrate'
        | 'mounted'
        | 'rollback'
        | 'snapshot'
        | 'snapshot-delete';
    memory?: number;
    mp0?: string;
    nameserver?: string;
    net0?: string;
    onboot?: boolean;
    ostype?:
        | 'debian'
        | 'devuan'
        | 'ubuntu'
        | 'centos'
        | 'fedora'
        | 'opensuse'
        | 'archlinux'
        | 'alpine'
        | 'gentoo'
        | 'unmanaged';
    password?: string;
    pool?: string;
    protection?: boolean;
    resotre?: boolean;
    rootfs?: string;
    searchdomain?: string;
    'ssh-public-keys'?: string;
    start?: boolean;
    startup?: string;
    storage?: string;
    swap?: number;
    tags?: string;
    template?: boolean;
    timezone?: string;
    tty?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    unique?: boolean;
    unprivileged?: boolean;
    unused0?: string;
}

/**
 * This interface is used to define a network interface in the PVE api
 */
export interface NetowrkInteface {
    iface: string;
    type: string;
    families: string[];
    active: 0 | 1;
    method6: string;
    priority: number;
    exists: 0 | 1;
    method: string;
    bridge_ports?: string;
    netmask?: string;
    address?: string;
    bridge_fd?: string;
    autostart?: number;
    gateway?: string;
    cidr?: string;
    bridge_stp?: string;
}

/**
 * This interface is used to define a node inside a cluster in the PVE api
 */
export interface ClusterNode {
    name: string;
    level?: string;
    type: string;
    local?: 0 | 1;
    online?: 0 | 1;
    ip?: string;
    id: string;
    nodeid?: number;
    quorate?: 0 | 1;
}

declare global {
    namespace Express {
        interface Request {
            agentIP: string | null;
        }
    }
}

/**
 * This interface is used to define the status of a container in the PVE api
 */
export interface ContainerStatus {
    id?: `${ContainerStatus['type']}/${ContainerStatus['vmid']}`;
    cpu: number; // Represents the cpu usage with 0 being 0% and 1 being 100%
    maxcpu: number; // Represents the number of cpu cores
    disk: number; // Represents the used disk size in bytes.
    diskread: number; // Represents the disk read in bytes.
    diskwrite: number; // Represents the disk write in bytes.
    maxdisk: number; // Represents the max disk size in bytes.
    maxmem: number; // Represents the max memory size in bytes.
    mem: number; // Represents the used memory size in bytes.
    name: string; // Represents the container name.
    netin: string; // Represents the network in in bytes.
    netout: number; // Represents the network out in bytes.
    status: 'running' | 'stopped'; // Represents the state of the container.
    template: 0 | 1; // Represents whether the container is a template
    type: 'lxc';
    uptime: number; // Represents the uptime in seconds.
    vmid: number; // Represents the container id.
}

/**
 * This interface is used to represent a PVE api response
 */
export interface ProxmoxResponse<T> {
    data?: T;
    errors?: string[];
    message?: string;
    success?: 0 | 1;
    status?: number;
}

export type status =
    | 'start'
    | 'stop'
    | 'shutdown'
    | 'suspend'
    | 'resume'
    | 'reboot';

/**
 * This interface is used to represent the result of an action performed
 */
export interface ActionResult<DataType = null> {
    error?: null | string;
    ok: boolean;
    data?: DataType;
}

/**
 * This interface is used to represent the configuration in the database
 */
export interface Config {
    ct_options: CTHardwareOptions;
    init_commands: string[];
}

/**
 * This interface is used to represent a client in the database
 */
export interface SQLClient {
    client_id?: number;
    client_secret?: string;
}

export type valueParam = string | number | Array<string | number>;

export interface Ticket {
    id: string;
    expires: number;
}

export interface Backup {
    notes?: string; // The backup notes
    vmid?: number;
    size: number; // The size of the backup in bytes
    ctime: number; // The creation time of the backup in seconds
    volid: string; // The volume id of the backup
    backuid?: string; // The backup id
    format: string; // the format file of the backup for example: 'tar.zst'
    content?: string | 'backup'; // The content type of the data that has been recieved from the storage
}

// export interface BackupE2 {
//     volid: string;
//     ctime: number;
//     mark: 'keep' | 'remove' | 'protected' | 'renamed';
//     vmid: number;
//     type: 'lxc' | 'qemu';
// }

// export interface Backup extends BackupE1, BackupE2 {}

export interface Storage {
    total: number; // the total size of storage in bytes
    used_fraction: number; // the used fraction of storage in percent / 100
    content: string; // the content type of the storage for example "backup,vztmpl,iso"
    storage: string; // the storage name
    type: string; // the storage type for example "dir"
    enabled: 0 | 1; // is the storage enabled
    avail: 0 | 1; // is the storage available
    shared: 0 | 1; // is the storage shared
    used: number; // the used size of storage in bytes
    active: 0 | 1; // is the storage active
}

export interface Snapshot {
    name: string; // the name of the snapshot
    description: string; // the description of the snapshot - can also be ''
    parent?: string; // id of the parent snapshot
    snaptime?: number; // the creation time of the snapshot in seconds
}

export interface VMResource {
    vmid: number; // the id of the VM
    type: 'vm' | 'lxc'; // the type of the resource
    name: string; // the name of the resource
    content: string; // the content type of the resource for example "backup,vztmpl,iso"
    cpu: number; // the cpu usage in percent
    disk: string; // the disk usage in bytes
    hstate: string;
    mem: number; // the memory usage in bytes
    netin: string; // the network in in bytes
    netout: string; // the network out in bytes
    level: string; // the support level of the resource
    status: 'running' | 'stopped'; // the status of the resource
    maxmem: number; // the max memory size in bytes
    maxdisk: number; // the max disk size in bytes
    node: string; // the node name
    plugintype: string; // the plugin type of the resource
    pool: string; // the pool name
    storage: string; // the storage name
    uptime: number; // the uptime in seconds
}

export interface ClientToServerEvents {
    shell_exec_sync: (containerID: string, script: string) => void;
}

export interface ServerToClientEvents {
    shell_exec_error: (error_message: string) => void;
    shell_exec_output: (data: string, type: 'stdout' | 'stderr') => void;
    shell_exec_started: (pid: number) => void;
    shelll_exec_finished: (
        status: 'success' | 'error',
        exitCode: number
    ) => void;
}
