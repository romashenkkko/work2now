const net = require("net");
const os = require("os");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");

/** IPv4 LAN pentru acces din rețea (preferă 192.168.x.x; exclude adaptoare virtuale Hyper-V/WSL). */
function getLanIPv4() {
  const candidates = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const iface = nets[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      const ip = addr.address;
      if (ip.startsWith("172.20.") || ip.startsWith("172.17.") || ip.startsWith("169.254.")) continue;
      const score = ip.startsWith("192.168.") ? 3 : ip.startsWith("10.") ? 2 : 1;
      candidates.push({ ip, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.ip ?? null;
}

/** Load server/.env into a plain object for the backend child process. */
function loadServerEnv(rootDir) {
  const envPath = path.join(rootDir, "server", ".env");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(200);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
    socket.connect(port, host);
  });
}

function waitForBackend(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryOne = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        if (attempts >= maxAttempts) {
          reject(new Error(`Backend returned ${res.statusCode} after ${maxAttempts} attempts`));
          return;
        }
        setTimeout(tryOne, 500);
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Backend not reachable after ${maxAttempts} attempts. Pornește MySQL (XAMPP) și rulează din nou.`));
          return;
        }
        setTimeout(tryOne, 500);
      });
      req.setTimeout(3000, () => {
        req.destroy();
        if (attempts >= maxAttempts) reject(new Error("Backend timeout"));
        else setTimeout(tryOne, 500);
      });
    };
    tryOne();
  });
}

async function isPortFree(port) {
  const ipv4InUse = await canConnect("127.0.0.1", port);
  if (ipv4InUse) return false;
  const ipv6InUse = await canConnect("::1", port);
  return !ipv6InUse;
}

async function findFreePort(startPort, exclude = new Set()) {
  for (let port = startPort; port <= 65535; port += 1) {
    if (exclude.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port);
    if (free) return port;
  }
  throw new Error(`No free port found starting from ${startPort}`);
}

function prefixOutput(stream, prefix) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      process.stdout.write(`[${prefix}] ${line}\n`);
    }
  });
}

function portFromEnvUrl(url, fallback) {
  if (!url || typeof url !== "string") return fallback;
  try {
    const u = new URL(url.trim());
    if (u.port) return Number(u.port);
    return u.protocol === "https:" ? 443 : 80;
  } catch {
    return fallback;
  }
}

async function main() {
  const rootDir = process.cwd();
  const serverEnv = loadServerEnv(rootDir);
  const preferredBackend = portFromEnvUrl(serverEnv.GOOGLE_CALLBACK_URL, 5600);
  const preferredFrontend = portFromEnvUrl(serverEnv.FRONTEND_URL, 5500);

  let backendPort = preferredBackend;
  let frontendPort = preferredFrontend;
  if (!(await isPortFree(backendPort))) {
    backendPort = await findFreePort(preferredBackend);
  }
  if (!(await isPortFree(frontendPort)) || frontendPort === backendPort) {
    frontendPort = await findFreePort(preferredFrontend, new Set([backendPort]));
  }

  const googleCallbackUrl = `http://localhost:${backendPort}/api/auth/google/callback`;
  if (backendPort !== preferredBackend || frontendPort !== preferredFrontend) {
    console.warn(
      `\n⚠ Porturile din server/.env (${preferredFrontend}/${preferredBackend}) sunt ocupate → folosesc ${frontendPort}/${backendPort}.`
    );
    console.warn(
      `  Adaugă în Google Cloud Console → OAuth → Authorized redirect URIs:\n  ${googleCallbackUrl}\n`
    );
  }

  const lanIp = getLanIPv4();
  console.log(`Starting dev -> frontend:${frontendPort} backend:${backendPort}`);

  const serverDir = path.join(rootDir, "server");
  const clientDir = path.join(rootDir, "client");

  const commonEnv = { ...process.env, ...serverEnv };
  // Google OAuth acceptă doar localhost (nu IP privat 172.x / 192.x) la redirect URI.
  const backendEnv = {
    ...commonEnv,
    HOST: "0.0.0.0",
    PORT: String(backendPort),
    FRONTEND_URL: `http://localhost:${frontendPort}`,
    GOOGLE_CALLBACK_URL: googleCallbackUrl,
    // Aliniat cu PHONE_OTP_ENABLED=false din Register.tsx (dev fără SMS obligatoriu)
    PHONE_REGISTRATION_OTP_REQUIRED: "false",
  };
  const frontendEnv = {
    ...commonEnv,
    VITE_PORT: String(frontendPort),
    VITE_API_PORT: String(backendPort),
    HOST: "0.0.0.0",
  };

  console.log(`\n  Local:   http://localhost:${frontendPort}`);
  console.log(`  API:     http://localhost:${backendPort}/api`);
  if (lanIp) {
    console.log(`  Rețea:   http://${lanIp}:${frontendPort}`);
    console.log(`  API LAN: http://${lanIp}:${backendPort}/api`);
  }
  console.log(`  Google redirect (copiază în Google Console dacă lipsește):`);
  console.log(`           ${googleCallbackUrl}\n`);

  const isWin = process.platform === "win32";
  const runCmd = isWin ? "cmd.exe" : "npm";
  const backArgs = isWin
    ? ["/d", "/s", "/c", `npm --prefix ${serverDir} run dev`]
    : ["--prefix", serverDir, "run", "dev"];
  const frontArgs = isWin
    ? ["/d", "/s", "/c", `npm --prefix ${clientDir} run dev`]
    : ["--prefix", clientDir, "run", "dev"];

  const back = spawn(runCmd, backArgs, {
    cwd: rootDir,
    env: backendEnv,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  prefixOutput(back.stdout, "back");
  prefixOutput(back.stderr, "back");

  let shuttingDown = false;
  const stopChildren = (includeFront) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!back.killed) back.kill();
    if (includeFront && frontRef.current && !frontRef.current.killed) frontRef.current.kill();
  };

  const frontRef = { current: null };

  back.on("exit", (code) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[back] exited with code ${code}`);
      stopChildren(true);
      process.exit(code || 1);
    }
  });

  try {
    console.log("Aștept backend-ul (API)...");
    await waitForBackend(backendPort);
    console.log("Backend gata. Pornesc frontend...");
  } catch (e) {
    console.error("Backend nu răspunde:", e.message);
    if (!back.killed) back.kill();
    process.exit(1);
  }

  const front = spawn(runCmd, frontArgs, {
    cwd: rootDir,
    env: frontendEnv,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });
  frontRef.current = front;

  prefixOutput(front.stdout, "front");
  prefixOutput(front.stderr, "front");

  const onExit = (name, code) => {
    if (shuttingDown) return;
    if (code === 0) return;
    console.error(`[${name}] exited with code ${code}`);
    stopChildren(true);
    process.exit(code || 1);
  };

  front.on("exit", (code) => onExit("front", code));

  process.on("SIGINT", () => {
    stopChildren(true);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopChildren(true);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Failed to start dev processes:", err);
  process.exit(1);
});
