export default `
CREATE DATABASE IF NOT EXISTS \`cw\` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;
USE \`cw\`;

-- Dumping structure for table cw.config
CREATE TABLE IF NOT EXISTS \`config\` (
  \`config\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

-- Dumping structure for table cw.cts
CREATE TABLE IF NOT EXISTS \`cts\` (
  \`id\` int(11) NOT NULL,
  \`ipv4\` varchar(16) NOT NULL,
  \`ready\` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

-- Dumping structure for table cw.ips
CREATE TABLE IF NOT EXISTS \`ips\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`ipv4\` varchar(16) NOT NULL,
  \`gateway\` varchar(16) NOT NULL,
  \`netmask\` varchar(16) NOT NULL,
  \`used\` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

-- Dumping structure for table cw.nodes
CREATE TABLE IF NOT EXISTS \`nodes\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`nodename\` varchar(255) NOT NULL,
  \`is_main\` bit(1) NOT NULL,
  \`ip\` varchar(16) NOT NULL,
  \`location\` varchar(255) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

-- Dumping structure for table cw.tasks
CREATE TABLE IF NOT EXISTS \`tasks\` (
  \`id\` varchar(24) NOT NULL,
  \`containerID\` varchar(16) NOT NULL,
  \`start_time\` bigint(20) NOT NULL,
  \`end_time\` bigint(20) DEFAULT NULL,
  \`data\` text DEFAULT NULL,
  \`status\` varchar(255) DEFAULT NULL,
  \`error\` text DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
