# Development Setup

## Port Conflicts

If you encounter `EADDRINUSE` error when starting the dev server (port 5000 already in use), use one of these solutions:

### Option 1: Kill the process using the port (Recommended)

```bash
sudo fuser -k 5000/tcp || true
```

Alternative method:
```bash
lsof -i :5000
# Then kill the process:
kill -9 <pid>
```

### Option 2: Change dev port

The dev server can be configured to use port 5001 instead. See `package.json` for the `dev` script.

## Installing ripgrep (Optional)

For better search performance, install ripgrep:

```bash
sudo apt-get update && sudo apt-get install -y ripgrep
```
