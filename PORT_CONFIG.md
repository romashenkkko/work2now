# Port Configuration Guide

This guide explains how to change the ports on which the Work2Now application runs.

## Current Default Ports

- **Frontend (Vite)**: `5174`
- **Backend (API)**: `5175`

## How to Change Ports

### Method 1: Environment Variables (Recommended)

#### For Backend Port

Create or edit `server/.env` file:

```env
PORT=3000
```

Or set it when running:
```bash
PORT=3000 npm run dev
```

#### For Frontend Port

Create or edit `client/.env` file:

```env
VITE_PORT=3001
VITE_API_PORT=3000
```

**Important**: If you change the backend port, also update `VITE_API_PORT` in `client/.env` to match!

#### For Windows PowerShell:

```powershell
$env:PORT=3000
$env:VITE_PORT=3001
$env:VITE_API_PORT=3000
npm run dev
```

### Method 2: Direct Code Changes

#### Backend Port

Edit `server/src/index.ts`:
```typescript
const PORT = process.env.PORT || 3000; // Change 5175 to your desired port
```

#### Frontend Port

Edit `client/vite.config.ts`:
```typescript
const FRONTEND_PORT = parseInt(process.env.VITE_PORT || "3001", 10); // Change 5174
const BACKEND_PORT = process.env.VITE_API_PORT || "3000"; // Change 5175
```

#### Client API Fallback

Edit `client/src/api/client.ts`:
```typescript
const apiPort = import.meta.env.VITE_API_PORT || "3000"; // Change 5175
```

## Example: Change Both Ports to 3000 and 3001

1. **Create `server/.env`**:
   ```env
   PORT=3000
   ```

2. **Create `client/.env`**:
   ```env
   VITE_PORT=3001
   VITE_API_PORT=3000
   ```

3. **Restart the application**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000

## Troubleshooting

### Port Already in Use

If you get an error that a port is already in use:

1. **Windows**: Find and stop the process:
   ```powershell
   netstat -ano | findstr :5174
   taskkill /PID <PID> /F
   ```

2. **Or change to a different port** using the methods above.

### Frontend Can't Connect to Backend

If the frontend can't reach the backend after changing ports:

1. Make sure `VITE_API_PORT` in `client/.env` matches the backend `PORT` in `server/.env`
2. Check that the proxy in `client/vite.config.ts` is using the correct backend port
3. Restart both servers after making changes

## Files That Reference Ports

- `server/src/index.ts` - Backend port (uses `process.env.PORT`)
- `client/vite.config.ts` - Frontend port and proxy configuration
- `client/src/api/client.ts` - Client-side API URL fallback
- `run.ps1` - PowerShell script for starting (reads from env vars)

