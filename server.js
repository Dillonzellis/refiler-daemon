const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf8"),
);

function requireToken(req, res, next) {
  const token = req.header("X-Refiler-Token");
  if (!cfg.token || token !== cfg.token) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/status", requireToken, async (req, res) => {
  const repoGitDir = path.join(cfg.repoPath, ".git");
  const repoPresent = fs.existsSync(repoGitDir);

  if (!repoPresent) {
    return res.json({
      ok: true,
      repoPresent: false,
      repoPath: cfg.repoPath,
      branch: cfg.branch,
      message: "Repo not found at repoPath (missing .git).",
    });
  }

  const head = await run("git", ["rev-parse", "HEAD"], { cwd: cfg.repoPath });
  const status = await run("git", ["status", "--porcelain"], {
    cwd: cfg.repoPath,
  });

  res.json({
    ok: true,
    repoPresent: true,
    repoPath: cfg.repoPath,
    branch: cfg.branch,
    headSha: head.code === 0 ? head.stdout.trim() : null,
    dirty: status.code === 0 ? status.stdout.trim().length > 0 : null,
    errors: {
      head: head.code === 0 ? null : head.stderr.trim() || `exit ${head.code}`,
      status:
        status.code === 0
          ? null
          : status.stderr.trim() || `exit ${status.code}`,
    },
  });
});

// Bind to localhost only.
app.listen(cfg.port, "127.0.0.1", () => {
  console.log(`[refiler-daemon] listening on http://127.0.0.1:${cfg.port}`);
});
