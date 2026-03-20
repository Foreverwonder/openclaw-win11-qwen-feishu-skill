const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile, spawn } = require("child_process");

const HOST = "127.0.0.1";
const PORT = 18809;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const CONTROL_STATE_PATH = path.join(ROOT, "control-center-state.json");
const PROJECT_DIR = path.resolve(ROOT, "..");
const USER_HOME = os.homedir();
const OPENCLAW_DIR = path.join(USER_HOME, ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_DIR, "openclaw.json");
const WORKSPACE_DIR = path.join(OPENCLAW_DIR, "workspace");
const MEMORY_DIR = path.join(WORKSPACE_DIR, "memory");
const MANAGED_SKILLS_DIR = path.join(OPENCLAW_DIR, "skills");
const CODEX_SKILLS_DIR = path.join(USER_HOME, ".codex", "skills");
const DASHBOARD_LAUNCHER = path.join(PROJECT_DIR, "openclaw-dashboard-stable.cmd");
const SUPERVISOR = path.join(OPENCLAW_DIR, "gateway-supervisor.cmd");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789/";

const BASE_ENV = {
  ...process.env,
  PATH: [
    "C:\\Users\\71976\\.local\\bin",
    "C:\\Users\\71976\\AppData\\Roaming\\npm",
    "C:\\Program Files\\nodejs",
    process.env.PATH || "",
  ].join(";"),
  NO_PROXY: "localhost,127.0.0.1,::1",
  no_proxy: "localhost,127.0.0.1,::1",
  OPENCLAW_CONFIG_PATH: CONFIG_PATH,
  OPENCLAW_STATE_DIR: OPENCLAW_DIR,
};

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 10) return "********";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function tailFile(filePath, maxLines = 40) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).slice(-maxLines);
}

function collectWarnings(...stderrList) {
  return [...new Set(
    stderrList
      .filter(Boolean)
      .flatMap((item) => String(item).split(/\r?\n/))
      .map((line) => line.trim())
      .filter(Boolean)
  )].slice(0, 20);
}

function pushModelHistory(entry) {
  const state = readJson(CONTROL_STATE_PATH, { modelHistory: [] });
  const history = Array.isArray(state.modelHistory) ? state.modelHistory : [];
  const next = [
    entry,
    ...history.filter(
      (item) =>
        !(
          item.providerId === entry.providerId &&
          item.modelId === entry.modelId &&
          item.baseUrl === entry.baseUrl &&
          item.api === entry.api
        )
    ),
  ].slice(0, 8);
  writeJson(CONTROL_STATE_PATH, { ...state, modelHistory: next });
  return next;
}

async function directModelTest() {
  const config = readJson(CONFIG_PATH, {});
  const primaryModel = config?.agents?.defaults?.model?.primary || "";
  const providerId = primaryModel.includes("/") ? primaryModel.split("/")[0] : "";
  const modelId = primaryModel.includes("/") ? primaryModel.split("/").slice(1).join("/") : "";
  const provider = config?.models?.providers?.[providerId];
  const apiKey = config?.env?.QWEN_CODING_PLAN_API_KEY || "";
  const baseUrl = provider?.baseUrl || "";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  if (!providerId || !modelId || !baseUrl || !apiKey) {
    return {
      ok: false,
      message: "当前模型配置不完整，无法做直连测试。",
      details: { providerId, modelId, baseUrl: Boolean(baseUrl), apiKey: Boolean(apiKey) },
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 20,
      temperature: 0,
    }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  const content = data?.choices?.[0]?.message?.content || data?.error?.message || text;
  return {
    ok: response.ok,
    status: response.status,
    endpoint,
    providerId,
    modelId,
    content,
    raw: data || text,
  };
}

function runPowerShell(command, timeoutMs = 120000) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      {
        cwd: USER_HOME,
        env: BASE_ENV,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error && typeof error.code === "number" ? error.code : 0,
          stdout: (stdout || "").trim(),
          stderr: (stderr || "").trim(),
          error: error ? String(error.message || error) : null,
        });
      }
    );
  });
}

async function runOpenClaw(args, timeoutMs = 120000) {
  const psPrefix = [
    `$env:OPENCLAW_CONFIG_PATH='${CONFIG_PATH.replace(/\\/g, "\\\\")}'`,
    `$env:OPENCLAW_STATE_DIR='${OPENCLAW_DIR.replace(/\\/g, "\\\\")}'`,
    `$env:NO_PROXY='localhost,127.0.0.1,::1'`,
    `$env:no_proxy='localhost,127.0.0.1,::1'`,
    `Set-Location '${USER_HOME.replace(/\\/g, "\\\\")}'`,
  ].join("; ");
  return runPowerShell(`${psPrefix}; & openclaw ${args}`, timeoutMs);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpCheck(targetUrl) {
  return new Promise((resolve) => {
    const req = http.get(targetUrl, (res) => {
      res.resume();
      resolve({
        ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode || 0,
      });
    });
    req.on("error", (error) => resolve({ ok: false, statusCode: 0, error: error.message }));
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
  });
}

async function ensureGateway() {
  spawn("cmd.exe", ["/c", "start", "", "/min", "cmd", "/c", `"${SUPERVISOR}"`], {
    cwd: PROJECT_DIR,
    env: BASE_ENV,
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  }).unref();

  for (let i = 0; i < 8; i += 1) {
    const probe = await httpCheck(DEFAULT_GATEWAY_URL);
    if (probe.ok) {
      return { ok: true, probe };
    }
    await wait(2500);
  }

  return { ok: false, probe: await httpCheck(DEFAULT_GATEWAY_URL) };
}

async function restartGateway() {
  await runPowerShell(
    [
      "$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*openclaw gateway run*' };",
      "foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }",
      "Start-Sleep -Seconds 2",
    ].join(" "),
    60000
  );
  return ensureGateway();
}

function extractJson(output) {
  const cleaned = (output || "")
    .replace(/\u0000/g, "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim();
  if (!cleaned) return null;

  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((v) => v >= 0);
  const ends = [cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]")].filter((v) => v >= 0);
  const candidates = [cleaned];

  for (const start of starts) {
    for (const end of ends) {
      if (end > start) {
        candidates.push(cleaned.slice(start, end + 1));
      }
    }
    candidates.push(cleaned.slice(start));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // keep trying
    }
  }

  return null;
}

async function collectStatus() {
  const config = readJson(CONFIG_PATH, {});
  const state = readJson(CONTROL_STATE_PATH, { modelHistory: [] });
  const gatewayProbe = await httpCheck(DEFAULT_GATEWAY_URL);
  const tokenArg = config?.gateway?.auth?.token ? ` --token ${config.gateway.auth.token}` : "";
  const [modelsRaw, memoryRaw, channelsRaw, skillsRaw, browserRaw] = await Promise.all([
    runOpenClaw("models status --json"),
    runOpenClaw("memory status --json"),
    runOpenClaw("channels status --json"),
    runOpenClaw("skills list --json"),
    runOpenClaw(`browser status --json${tokenArg}`),
  ]);

  const primaryModel = config?.agents?.defaults?.model?.primary || "未设置";
  const providerId = primaryModel.includes("/") ? primaryModel.split("/")[0] : null;
  const provider = providerId && config?.models?.providers ? config.models.providers[providerId] : null;
  const modelEntry = provider?.models?.[0] || null;
  const feishu = config?.channels?.feishu || {};
  const token = config?.gateway?.auth?.token || "";
  const dashboardUrl = token ? `${DEFAULT_GATEWAY_URL}#token=${token}` : DEFAULT_GATEWAY_URL;

  return {
    generatedAt: new Date().toISOString(),
    paths: {
      projectDir: PROJECT_DIR,
      configPath: CONFIG_PATH,
      workspaceDir: WORKSPACE_DIR,
      memoryDir: MEMORY_DIR,
      managedSkillsDir: MANAGED_SKILLS_DIR,
      codexSkillsDir: CODEX_SKILLS_DIR,
      dashboardLauncher: DASHBOARD_LAUNCHER,
      supervisor: SUPERVISOR,
    },
    gateway: {
      url: DEFAULT_GATEWAY_URL,
      dashboardUrl,
      probe: gatewayProbe,
      mode: config?.gateway?.mode || null,
      bind: config?.gateway?.bind || null,
      authMode: config?.gateway?.auth?.mode || null,
    },
    modelConfig: {
      providerId,
      baseUrl: provider?.baseUrl || "",
      api: provider?.api || "",
      modelId: modelEntry?.id || "",
      modelName: modelEntry?.name || "",
      reasoning: Boolean(modelEntry?.reasoning),
      primary: primaryModel,
      apiKeyMasked: maskSecret(config?.env?.QWEN_CODING_PLAN_API_KEY || ""),
    },
    feishuConfig: {
      enabled: Boolean(feishu?.enabled),
      appId: feishu?.appId || "",
      appSecretMasked: maskSecret(feishu?.appSecret || ""),
    },
    memoryFolderExists: fs.existsSync(MEMORY_DIR),
    history: {
      modelHistory: Array.isArray(state.modelHistory) ? state.modelHistory : [],
    },
    raw: {
      models: { ok: modelsRaw.ok, data: extractJson(modelsRaw.stdout), stderr: modelsRaw.stderr || null },
      memory: { ok: memoryRaw.ok, data: extractJson(memoryRaw.stdout), stderr: memoryRaw.stderr || null },
      channels: { ok: channelsRaw.ok, data: extractJson(channelsRaw.stdout), stderr: channelsRaw.stderr || null },
      skills: { ok: skillsRaw.ok, data: extractJson(skillsRaw.stdout), stderr: skillsRaw.stderr || null },
      browser: { ok: browserRaw.ok, data: extractJson(browserRaw.stdout), stderr: browserRaw.stderr || null },
    },
    warnings: collectWarnings(
      modelsRaw.stderr,
      memoryRaw.stderr,
      channelsRaw.stderr,
      skillsRaw.stderr,
      browserRaw.stderr
    ),
    logs: {
      controlCenter: tailFile(path.join(ROOT, "control-center.log")),
      gatewaySupervisor: tailFile(path.join(OPENCLAW_DIR, "gateway-supervisor.log")),
    },
    docs: [
      { title: "Windows / FAQ", url: "https://docs.openclaw.ai/help/faq" },
      { title: "Gateway CLI", url: "https://docs.openclaw.ai/cli/gateway" },
      { title: "Config CLI", url: "https://docs.openclaw.ai/cli/config" },
      { title: "Models CLI", url: "https://docs.openclaw.ai/cli/models" },
      { title: "Memory CLI", url: "https://docs.openclaw.ai/cli/memory" },
      { title: "Skills CLI", url: "https://docs.openclaw.ai/cli/skills" },
      { title: "Channels CLI", url: "https://docs.openclaw.ai/cli/channels" },
      { title: "Browser CLI", url: "https://docs.openclaw.ai/cli/browser" },
    ],
    bestPractices: [
      "网关只绑定 loopback，避免对局域网或公网暴露。",
      "主力机上保留 allowlist + ask 的执行审批，不裸开危险执行。",
      "把 Dashboard 与管理页都固定走 127.0.0.1，并为 localhost/::1 设置 no_proxy。",
      "模型优先用自定义 provider 做显式配置，别把不兼容接口硬伪装成别的 provider。",
      "记忆目录先建好再索引，避免 memory status 一直脏状态。",
      "技能目录分离：OpenClaw 运行时技能放 ~/.openclaw/skills，Codex 技能放 ~/.codex/skills。",
    ],
  };
}

async function saveModelConfig(payload) {
  const config = readJson(CONFIG_PATH, {});
  const providerId = payload.providerId || "qwen-coding-plan";
  const modelId = payload.modelId || "qwen3.5-plus";
  const modelName = payload.modelName || modelId;
  const primary = `${providerId}/${modelId}`;

  config.env = config.env || {};
  const existingApiKey = config?.env?.QWEN_CODING_PLAN_API_KEY || "";
  config.env.QWEN_CODING_PLAN_API_KEY = payload.apiKey || existingApiKey;
  config.models = config.models || {};
  config.models.mode = config.models.mode || "merge";
  config.models.providers = config.models.providers || {};
  config.models.providers[providerId] = {
    baseUrl: payload.baseUrl || "https://coding.dashscope.aliyuncs.com/v1",
    apiKey: "${QWEN_CODING_PLAN_API_KEY}",
    api: payload.api || "openai-completions",
    models: [
      {
        id: modelId,
        name: modelName,
        reasoning: Boolean(payload.reasoning),
        input: ["text"],
      },
    ],
  };
  config.agents = config.agents || {};
  config.agents.defaults = config.agents.defaults || {};
  config.agents.defaults.model = { primary };
  config.agents.defaults.models = config.agents.defaults.models || {};
  config.agents.defaults.models[primary] = { alias: modelName };
  writeJson(CONFIG_PATH, config);
  pushModelHistory({
    savedAt: new Date().toISOString(),
    providerId,
    modelId,
    modelName,
    baseUrl: payload.baseUrl || "https://coding.dashscope.aliyuncs.com/v1",
    api: payload.api || "openai-completions",
    reasoning: Boolean(payload.reasoning),
  });
  return runOpenClaw("config validate");
}

async function saveFeishuConfig(payload) {
  const config = readJson(CONFIG_PATH, {});
  const existingSecret = config?.channels?.feishu?.appSecret || "";
  config.channels = config.channels || {};
  config.channels.feishu = {
    ...(config.channels.feishu || {}),
    appId: payload.appId || "",
    appSecret: payload.appSecret || existingSecret,
    enabled: Boolean(payload.enabled),
  };
  config.plugins = config.plugins || {};
  config.plugins.entries = config.plugins.entries || {};
  config.plugins.entries.feishu = {
    ...(config.plugins.entries.feishu || {}),
    enabled: Boolean(payload.enabled),
  };
  writeJson(CONFIG_PATH, config);
  return runOpenClaw("config validate");
}

async function performAction(action, payload = {}) {
  switch (action) {
    case "ensureGateway":
      return ensureGateway();
    case "restartGateway":
      return restartGateway();
    case "openDashboard":
      spawn("cmd.exe", ["/c", "start", "", `"${DASHBOARD_LAUNCHER}"`], {
        cwd: PROJECT_DIR,
        env: BASE_ENV,
        detached: true,
        windowsHide: true,
        stdio: "ignore",
      }).unref();
      return { ok: true, message: "已调用稳定版 Dashboard 启动器。" };
    case "validateConfig":
      return runOpenClaw("config validate");
    case "testModel":
      return directModelTest();
    case "memorySetup":
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
      return { ok: true, message: `已确保记忆目录存在：${MEMORY_DIR}` };
    case "reindexMemory":
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
      return runOpenClaw("memory index --force", 180000);
    case "openConfigFolder":
      spawn("explorer.exe", [OPENCLAW_DIR], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
      return { ok: true, message: "已打开 OpenClaw 配置目录。" };
    case "openWorkspaceFolder":
      spawn("explorer.exe", [WORKSPACE_DIR], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
      return { ok: true, message: "已打开 workspace 目录。" };
    case "openSkillsFolder":
      spawn("explorer.exe", [CODEX_SKILLS_DIR], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
      return { ok: true, message: "已打开 Codex skills 目录。" };
    case "openManagedSkillsFolder":
      spawn("explorer.exe", [MANAGED_SKILLS_DIR], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
      return { ok: true, message: "已打开 OpenClaw managed skills 目录。" };
    case "openDocs":
      if (fs.existsSync(EDGE)) {
        spawn(EDGE, [
          "--new-window",
          '--proxy-server="direct://"',
          '--proxy-bypass-list="<-loopback>;127.0.0.1;localhost;::1"',
          payload.url || "https://docs.openclaw.ai/cli",
        ], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
      }
      return { ok: true, message: "已打开官方文档。" };
    default:
      return { ok: false, message: `不支持的动作：${action}` };
  }
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  }[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/status") {
      return json(res, 200, await collectStatus());
    }

    if (req.method === "GET" && req.url === "/api/logs") {
      const status = await collectStatus();
      return json(res, 200, status.logs);
    }

    if (req.method === "POST" && req.url === "/api/action") {
      const body = await readBody(req);
      return json(res, 200, await performAction(body.action, body.payload || {}));
    }

    if (req.method === "POST" && req.url === "/api/config/model") {
      const body = await readBody(req);
      return json(res, 200, await saveModelConfig(body));
    }

    if (req.method === "POST" && req.url === "/api/config/feishu") {
      const body = await readBody(req);
      return json(res, 200, await saveFeishuConfig(body));
    }

    if (req.method === "GET") {
      return serveStatic(req, res);
    }

    return json(res, 404, { ok: false, message: "Not found" });
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message || String(error) });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`OpenClaw Control Center is already running at http://${HOST}:${PORT}/`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`OpenClaw Control Center running at http://${HOST}:${PORT}/`);
});
