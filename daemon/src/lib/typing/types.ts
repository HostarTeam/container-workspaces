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
    ssl_fingerprint: string;
    uptime: number;
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

export interface CTOptions {
    ct_cores: number;
    ct_disk: number;
    ct_ram: number;
    ct_swap: number;
}
