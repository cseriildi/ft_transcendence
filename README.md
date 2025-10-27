# ft_transcendence

## Quick guide to running Transendence

### 🚀 One-command setup:

**42 PCs (ports 8443/8080):**

```bash
make
```

**Privileged ports for VMs/Private Machines (ports 443/80):**

```bash
make ports=privileged up
```

This will automatically:

- Generate SSL certificates
- Build all containers
- Start all services

### 🌐 Access the application:

**42 PCs (non-privileged ports):**

- **HTTPS**: https://localhost:8443
- **HTTP**: http://localhost:8080 (redirects to HTTPS)

**Production (privileged ports):**

- **HTTPS**: https://localhost (port 443 is default)
- **HTTP**: http://localhost (redirects to HTTPS)

### Other usefull commands:

```bash
make help
```
