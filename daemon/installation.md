# Container Workspaces Daemon

## Requirements

-   Node.js (v14.x or higher)
-   NPM (v6.x or higher)
-   SQL Database (MySQL, PostgreSQL, MariaDB)

---

## Installation

> Must be run as root.

-   Debian based distributions

    ```bash
    # Node.js and NPM installation
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
    apt install -y nodejs

    # SQL Database installation
    apt install -y mariadb-server
    ```

-   CentOS (RHEL based distributions)

    ```bash
    # Node.js and NPM installation
    curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
    yum install -y nodejs

    # SQL Database installation
    yum install -y mariadb-server
    systemctl enable mariadb --now
    ```

Now, run the setup script:

```bash
cwsetup
```

And now you can start the daemon:

```bash
systemctl start cwdaemon
```
