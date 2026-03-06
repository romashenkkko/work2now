const net = require("net");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

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

async function main() {
  const backendPort = await findFreePort(5600);
  const frontendPort = await findFreePort(5500, new Set([backendPort]));

  console.log(`Starting dev with free ports -> frontend:${frontendPort} backend:${backendPort}`);

  const rootDir = process.cwd();
  const serverDir = path.join(rootDir, "server");
  const clientDir = path.join(rootDir, "client");

  const commonEnv = { ...process.env };
  const backendEnv = { ...commonEnv, PORT: String(backendPort) };
  const frontendEnv = {
    ...commonEnv,
    VITE_PORT: String(frontendPort),
    VITE_API_PORT: String(backendPort),
  };

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
