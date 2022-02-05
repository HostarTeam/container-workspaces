import MessageRouting from '../ws/routing/MessageRouting';

export interface Configuration {
    apiKey: string;
    address: string;
    port: number;
}

export type httpProtocol = 'http' | 'https';

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

export interface CommandError {
    command: string;
    stderr: string;
    stdout: string;
    exitCode: number;
    stack: string;
    message: string;
}

export type CommandType = 'realtime' | 'init';

export type MessageRoutingHandler = MessageRouting[keyof MessageRouting];

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
    unprivilieged?: boolean;
    unused0?: string;
}

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

export interface SQLNode {
    id: number;
    nodename: string;
    is_main: 1 | 0;
    ip: string;
    location: string;
}

declare global {
    namespace Express {
        interface Request {
            agentIP: string | null;
        }
    }
}

export interface CT {
    id: number;
    ipv4: string;
}

export interface ContainerStatus {
    cpu: number; // Represents the cpu usage with 0 being 0% and 1 being 100%
    cpus: number; // Represents the number of cpu cores
    disk: number; // Represents the used disk size in bytes.
    diskread: number; // Represents the disk read in bytes.
    diskwrite: number; // Represents the disk write in bytes.
    ha: { managed: 0 | 1 };
    maxdisk: number; // Represents the max disk size in bytes.
    maxmem: number; // Represents the max memory size in bytes.
    maxswap: number; // Represents the max swap size in bytes.
    mem: number; // Represents the used memory size in bytes.
    name: string; // Represents the container name.
    netin: string; // Represents the network in in bytes.
    netout: number; // Represents the network out in bytes.
    pid: number; // Represents the process id of the container.
    status: 'running' | 'stopped'; // Represents the state of the container.
    swap: number; // Represents the used swap size in bytes.
    type: 'lxc';
    uptime: number; // Represents the uptime in seconds.
    vmid: number; // Represents the container id.
}

export interface ProxmoxResponse {
    data?: any;
    [key: string]: any;
}

export type status =
    | 'start'
    | 'stop'
    | 'shutdown'
    | 'suspend'
    | 'resume'
    | 'reboot';

export interface SQLIP {
    id: number;
    ipv4: string;
    gateway: string;
    netmask: string;
    used: 0 | 1;
}

export interface ActionResult {
    error: null | string;
    ok: boolean;
}
