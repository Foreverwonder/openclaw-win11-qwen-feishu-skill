const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFile } = require("child_process");

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
const NODE_EXE = "C:\\Program Files\\nodejs\\node.exe";
const OPENCLAW_ENTRY = "C:\\Users\\71976\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\index.js";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEFAULT_GATEWAY_URL = "http://127.0.0.1:18789/";
const REQUIRED_CONTROL_UI_ORIGINS = [
  "http://127.0.0.1:18789",
  "http://localhost:18789",
  "http://127.0.0.1:18809",
  "http://localhost:18809",
];

// Rate limiting: simple in-memory rate limiter for API endpoints
const rateLimiter = (() => {
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 60; // max 60 requests per window
  const requests = new Map();
  return (req) => {
    const now = Date.now();
    const key = req.socket.remoteAddress || "unknown";
    const window = requests.get(key) || [];
    const validWindow = window.filter((t) => now - t < windowMs);
    if (validWindow.length >= maxRequests) {
      return false;
    }
    validWindow.push(now);
    requests.set(key, validWindow);
    return true;
  };
})();

// API authentication: validate token for sensitive endpoints
let gatewayToken = "";
function validateAuth(req) {
  // For now, validate against the gateway token if set
  if (!gatewayToken) return true; // No token configured, allow all
  const authHeader = req.headers["authorization"];
  const queryToken = new URL(req.url, "http://localhost").searchParams.get("token");
  const providedToken = authHeader?.replace(/^Bearer\s+/i, "") || queryToken || "";
  return providedToken === gatewayToken;
}

function setGatewayToken(token) {
  gatewayToken = token || "";
}
let lastEnsureGatewayAt = 0;
const MANUAL_GATEWAY_STOP_MS = 12 * 60 * 60 * 1000;

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

function maskSecretLike(value) {
  if (!value) return "";
  if (typeof value === "string") {
    return maskSecret(value);
  }
  if (typeof value === "object") {
    const source = value.source || "?";
    const provider = value.provider || "default";
    const id = value.id || "unknown";
    return `SecretRef(${source}:${provider}:${id})`;
  }
  return "";
}

function getEnvSecretRef(id) {
  return {
    source: "env",
    provider: "default",
    id,
  };
}

function readUserEnvVar(name) {
  return process.env[name]
    || process.env[name.toUpperCase()]
    || process.env[name.toLowerCase()]
    || "";
}

function resolveProviderApiKey(provider, fallbackEnvNames = []) {
  if (typeof provider?.apiKey === "string") {
    const placeholderMatch = provider.apiKey.match(/^\$\{([A-Z0-9_]+)\}$/);
    if (placeholderMatch) {
      return readUserEnvVar(placeholderMatch[1]);
    }
    return provider.apiKey;
  }

  if (typeof provider?.apiKey === "object" && provider.apiKey?.id) {
    return readUserEnvVar(provider.apiKey.id);
  }

  for (const name of fallbackEnvNames) {
    const value = readUserEnvVar(name);
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeOriginList(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .filter((value) => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function ensureControlUiOrigins(config) {
  const currentOrigins = normalizeOriginList(config?.gateway?.controlUi?.allowedOrigins);
  const missingOrigins = REQUIRED_CONTROL_UI_ORIGINS.filter((origin) => !currentOrigins.includes(origin));

  if (missingOrigins.length === 0) {
    return {
      changed: false,
      origins: currentOrigins,
      missingOrigins: [],
    };
  }

  config.gateway = config.gateway || {};
  config.gateway.controlUi = config.gateway.controlUi || {};
  config.gateway.controlUi.allowedOrigins = [...currentOrigins, ...missingOrigins];
  writeJson(CONFIG_PATH, config);

  return {
    changed: true,
    origins: config.gateway.controlUi.allowedOrigins,
    missingOrigins,
  };
}

function ensureMainAgentModelSync(config) {
  const primary = config?.agents?.defaults?.model?.primary;
  if (!primary) {
    return { changed: false, primary: null };
  }

  config.agents = config.agents || {};
  config.agents.list = Array.isArray(config.agents.list) ? config.agents.list : [];
  const mainIndex = config.agents.list.findIndex((agent) => agent && agent.id === "main");

  if (mainIndex >= 0) {
    if (config.agents.list[mainIndex]?.model === primary) {
      return { changed: false, primary };
    }
    config.agents.list[mainIndex] = {
      ...config.agents.list[mainIndex],
      model: primary,
    };
    writeJson(CONFIG_PATH, config);
    return { changed: true, primary };
  }

  config.agents.list.push({
    id: "main",
    model: primary,
    tools: {
      profile: "coding",
    },
  });
  writeJson(CONFIG_PATH, config);
  return { changed: true, primary };
}

function tailFile(filePath, maxLines = 40) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).slice(-maxLines);
}

function isBenignCliWarning(line) {
  return /channels\.feishu\.appSecret: unresolved SecretRef "env:default:OPENCLAW_FEISHU_APP_SECRET"/.test(line);
}

function sanitizeCliStderr(stderr) {
  const lines = String(stderr || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isBenignCliWarning(line));

  return lines.length ? lines.join("\n") : null;
}

function collectWarnings(...stderrList) {
  return [...new Set(
    stderrList
      .filter(Boolean)
      .flatMap((item) => String(item).split(/\r?\n/))
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !isBenignCliWarning(line))
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

function getControlState() {
  return readJson(CONTROL_STATE_PATH, { modelHistory: [] }) || { modelHistory: [] };
}

function setGatewayManualStop(active) {
  const state = getControlState();
  if (active) {
    state.gatewayManuallyStoppedAt = new Date().toISOString();
  } else {
    delete state.gatewayManuallyStoppedAt;
  }
  writeJson(CONTROL_STATE_PATH, state);
}

function getGatewayManualStopState() {
  const state = getControlState();
  const stoppedAt = state.gatewayManuallyStoppedAt;
  if (!stoppedAt) {
    return { active: false, stoppedAt: null };
  }

  const ageMs = Date.now() - new Date(stoppedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MANUAL_GATEWAY_STOP_MS) {
    delete state.gatewayManuallyStoppedAt;
    writeJson(CONTROL_STATE_PATH, state);
    return { active: false, stoppedAt: null };
  }

  return { active: true, stoppedAt };
}

async function directModelTest() {
  const config = readJson(CONFIG_PATH, {});
  const primaryModel = config?.agents?.defaults?.model?.primary || "";
  const providerId = primaryModel.includes("/") ? primaryModel.split("/")[0] : "";
  const modelId = primaryModel.includes("/") ? primaryModel.split("/").slice(1).join("/") : "";
  const provider = config?.models?.providers?.[providerId];
  const api = provider?.api || "";
  const apiKey = resolveProviderApiKey(
    provider,
    api === "anthropic-messages"
      ? ["ANTHROPIC_AUTH_TOKEN", "MINIMAX_API_KEY"]
      : ["OPENAI_API_KEY"]
  );
  const baseUrl = provider?.baseUrl || "";
  const endpoint = api === "anthropic-messages"
    ? `${baseUrl.replace(/\/$/, "")}/v1/messages`
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  if (!providerId || !modelId || !baseUrl || !apiKey || !api) {
    return {
      ok: false,
      message: "当前模型配置不完整，无法做直连测试。",
      details: { providerId, modelId, baseUrl: Boolean(baseUrl), apiKey: Boolean(apiKey), api: Boolean(api) },
    };
  }

  const response = await fetch(
    endpoint,
    api === "anthropic-messages"
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: "user", content: "Reply with OK only." }],
            max_tokens: 128,
            temperature: 0,
          }),
        }
      : {
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
        }
  );

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  const content = api === "anthropic-messages"
    ? (
        data?.content?.find?.((item) => item.type === "text")?.text
        || data?.content?.[0]?.text
        || data?.content?.[0]?.thinking
        || data?.error?.message
        || text
      )
    : (data?.choices?.[0]?.message?.content || data?.error?.message || text);
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
  const cli = `& '${NODE_EXE.replace(/\\/g, "\\\\")}' '${OPENCLAW_ENTRY.replace(/\\/g, "\\\\")}' ${args}`;
  return runPowerShell(`${psPrefix}; ${cli}`, timeoutMs);
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
  setGatewayManualStop(false);
  lastEnsureGatewayAt = Date.now();
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
  setGatewayManualStop(false);
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

async function stopGateway() {
  setGatewayManualStop(true);
  await runPowerShell(
    [
      "$patterns = @('gateway-supervisor.cmd', 'gateway-start.cmd', 'openclaw\\dist\\index.js\" gateway run', 'openclaw\\dist\\index.js gateway run');",
      "$procs = Get-CimInstance Win32_Process | Where-Object {",
      "  $cmd = $_.CommandLine;",
      "  $cmd -and ($patterns | Where-Object { $cmd -like ('*' + $_ + '*') })",
      "};",
      "foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }",
      "Start-Sleep -Seconds 2",
    ].join(" "),
    60000
  );
  return { ok: true, message: "已停止 gateway 与 supervisor，后续不会自动拉起，直到你手动点击拉起/重启。" };
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
  let config = readJson(CONFIG_PATH, {});
  const controlUiRepair = ensureControlUiOrigins(config);
  if (controlUiRepair.changed) {
    config = readJson(CONFIG_PATH, config);
  }
  const modelSyncRepair = ensureMainAgentModelSync(config);
  if (modelSyncRepair.changed) {
    config = readJson(CONFIG_PATH, config);
  }
  const state = getControlState();
  const manualStop = getGatewayManualStopState();
  const gatewayProbe = await httpCheck(DEFAULT_GATEWAY_URL);
  if (!gatewayProbe.ok && !manualStop.active && Date.now() - lastEnsureGatewayAt > 20000) {
    ensureGateway().catch(() => {});
  }
  let gatewayToken = "";
  const rawToken = config?.gateway?.auth?.token;
  if (typeof rawToken === "string") {
    gatewayToken = rawToken;
  } else if (typeof rawToken === "object" && rawToken?.id) {
    gatewayToken = readUserEnvVar(rawToken.id);
  }
  const tokenArg = gatewayToken ? ` --token ${gatewayToken}` : "";

  // 性能优化：顺序执行命令，而不是 Promise.all 并发。
  // 因为每次 runOpenClaw 都会在 Windows 启动一个新的 PowerShell 和 Node.js 进程。
  // 并发拉起 5 个重进程会导致 CPU 瞬间 100% 占用并引发鼠标卡顿。
  const modelsRaw = await runOpenClaw("models status --json");
  const memoryRaw = await runOpenClaw("memory status --json");
  const channelsRaw = await runOpenClaw("channels status --json");
  const skillsRaw = await runOpenClaw("skills list --json");
  const browserRaw = await runOpenClaw(`browser status --json${tokenArg}`);

  const primaryModel = config?.agents?.defaults?.model?.primary || "未设置";
  const providerId = primaryModel.includes("/") ? primaryModel.split("/")[0] : null;
  const provider = providerId && config?.models?.providers ? config.models.providers[providerId] : null;
  const modelEntry = provider?.models?.[0] || null;
  const feishu = config?.channels?.feishu || {};
  setGatewayToken(gatewayToken);
  const dashboardUrl = DEFAULT_GATEWAY_URL;

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
      manuallyStopped: manualStop.active,
      manuallyStoppedAt: manualStop.stoppedAt,
      mode: config?.gateway?.mode || null,
      bind: config?.gateway?.bind || null,
      authMode: config?.gateway?.auth?.mode || null,
      authToken: gatewayToken,
    },
    controlUi: {
      allowedOrigins: normalizeOriginList(config?.gateway?.controlUi?.allowedOrigins),
      selfHealApplied: controlUiRepair.changed,
      addedOrigins: controlUiRepair.missingOrigins,
    },
    modelSync: {
      selfHealApplied: modelSyncRepair.changed,
      primary: config?.agents?.defaults?.model?.primary || null,
      mainAgentModel: config?.agents?.list?.find?.((agent) => agent && agent.id === "main")?.model || null,
    },
    modelConfig: {
      providerId,
      baseUrl: provider?.baseUrl || "",
      api: provider?.api || "",
      modelId: modelEntry?.id || "",
      modelName: modelEntry?.name || "",
      reasoning: Boolean(modelEntry?.reasoning),
      primary: primaryModel,
      apiKeyMasked: maskSecretLike(config?.env?.QWEN_CODING_PLAN_API_KEY || provider?.apiKey || ""),
    },
    feishuConfig: {
      enabled: Boolean(feishu?.enabled),
      appId: feishu?.appId || "",
      appSecretMasked: maskSecretLike(feishu?.appSecret || ""),
    },
    memoryFolderExists: fs.existsSync(MEMORY_DIR),
    history: {
      modelHistory: Array.isArray(state.modelHistory) ? state.modelHistory : [],
    },
    raw: {
      models: { ok: modelsRaw.ok, data: extractJson(modelsRaw.stdout), stderr: sanitizeCliStderr(modelsRaw.stderr) },
      memory: { ok: memoryRaw.ok, data: extractJson(memoryRaw.stdout), stderr: sanitizeCliStderr(memoryRaw.stderr) },
      channels: { ok: channelsRaw.ok, data: extractJson(channelsRaw.stdout), stderr: sanitizeCliStderr(channelsRaw.stderr) },
      skills: { ok: skillsRaw.ok, data: extractJson(skillsRaw.stdout), stderr: sanitizeCliStderr(skillsRaw.stderr) },
      browser: { ok: browserRaw.ok, data: extractJson(browserRaw.stdout), stderr: sanitizeCliStderr(browserRaw.stderr) },
    },
    warnings: collectWarnings(
      sanitizeCliStderr(modelsRaw.stderr),
      sanitizeCliStderr(memoryRaw.stderr),
      sanitizeCliStderr(channelsRaw.stderr),
      sanitizeCliStderr(skillsRaw.stderr),
      sanitizeCliStderr(browserRaw.stderr),
      modelSyncRepair.changed
        ? `Model self-heal: synced agents.list.main.model -> ${modelSyncRepair.primary}`
        : null,
      controlUiRepair.changed
        ? `Control UI self-heal: added gateway.controlUi.allowedOrigins -> ${controlUiRepair.missingOrigins.join(", ")}`
        : null
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
  const legacyPrimary = `${providerId}/${modelId.replace(/-/g, " ")}`;
  const isAnthropicProvider = (payload.api || "").trim() === "anthropic-messages";
  config.models = config.models || {};
  config.models.mode = config.models.mode || "merge";
  config.models.providers = config.models.providers || {};
  const existingProvider = config.models.providers[providerId] || {};
  const existingApiKey = existingProvider.apiKey;
  let nextApiKey = existingApiKey;

  if (payload.apiKey) {
    nextApiKey = getEnvSecretRef(isAnthropicProvider ? "MINIMAX_API_KEY" : "OPENAI_API_KEY");
  }

  config.models.providers[providerId] = {
    ...existingProvider,
    baseUrl: payload.baseUrl || (isAnthropicProvider ? "https://v2.aicodee.com" : "https://coding.dashscope.aliyuncs.com/v1"),
    apiKey: nextApiKey || getEnvSecretRef(isAnthropicProvider ? "MINIMAX_API_KEY" : "OPENAI_API_KEY"),
    api: payload.api || (isAnthropicProvider ? "anthropic-messages" : "openai-completions"),
    ...(isAnthropicProvider
      ? {
          auth: "api-key",
          headers: {
            "x-api-key": getEnvSecretRef("MINIMAX_API_KEY"),
          },
        }
      : {}),
    models: [
      {
        id: modelId,
        name: modelName,
        reasoning: Boolean(payload.reasoning),
        input: ["text"],
      },
    ],
  };
  if (config.env && Object.prototype.hasOwnProperty.call(config.env, "QWEN_CODING_PLAN_API_KEY")) {
    delete config.env.QWEN_CODING_PLAN_API_KEY;
    if (Object.keys(config.env).length === 0) {
      delete config.env;
    }
  }
  config.agents = config.agents || {};
  config.agents.defaults = config.agents.defaults || {};
  config.agents.defaults.model = { primary };
  config.agents.defaults.models = config.agents.defaults.models || {};
  delete config.agents.defaults.models[legacyPrimary];
  config.agents.defaults.models[primary] = { alias: modelName };
  config.agents.list = Array.isArray(config.agents.list) ? config.agents.list : [];
  const mainIndex = config.agents.list.findIndex((agent) => agent && agent.id === "main");
  if (mainIndex >= 0) {
    config.agents.list[mainIndex] = {
      ...config.agents.list[mainIndex],
      model: primary,
    };
  } else {
    config.agents.list.push({
      id: "main",
      model: primary,
      tools: {
        profile: "coding",
      },
    });
  }
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
    case "stopGateway":
      return stopGateway();
    case "openDashboard":
      setGatewayManualStop(false);
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
          "--new-tab",
          '--proxy-server="direct://"',
          '--proxy-bypass-list="<-loopback>;127.0.0.1;localhost;::1"',
          payload.url || "https://docs.openclaw.ai/cli",
        ], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
        return { ok: true, message: "已用 Edge 打开官方文档。" };
      }
      return { ok: false, message: "未找到 Edge 浏览器，请手动前往文档页面。" };
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

// 全局缓存控制中心状态，避免频繁请求后端带来的卡顿
let _statusCache = null;
let _statusCacheTime = 0;
let _statusCollectingPromise = null;

async function collectStatusWithCache(force = false) {
  // 如果非强制刷新，并且缓存有效（25秒内），直接返回缓存
  if (!force && _statusCache && (Date.now() - _statusCacheTime < 25000)) {
    return _statusCache;
  }
  // 如果当前已经有一个收集任务在运行，复用它
  if (_statusCollectingPromise) {
    return _statusCollectingPromise;
  }
  _statusCollectingPromise = collectStatus().finally(() => {
    _statusCollectingPromise = null;
  });
  const res = await _statusCollectingPromise;
  _statusCache = res;
  _statusCacheTime = Date.now();
  return res;
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
    // Apply rate limiting to API endpoints
    if (req.url.startsWith("/api/")) {
      if (!rateLimiter(req)) {
        return json(res, 429, { ok: false, message: "Too many requests" });
      }
    }

    if (req.method === "GET" && req.url.startsWith("/api/status")) {
      const force = req.url.includes("force=true");
      return json(res, 200, await collectStatusWithCache(force));
    }

    if (req.method === "GET" && req.url.startsWith("/api/logs")) {
      const force = req.url.includes("force=true");
      const status = await collectStatusWithCache(force);
      return json(res, 200, status.logs);
    }

    // Protected endpoints: require authentication
    if (req.method === "POST" && req.url === "/api/action") {
      if (!validateAuth(req)) {
        return json(res, 401, { ok: false, message: "Unauthorized" });
      }
      const body = await readBody(req);
      return json(res, 200, await performAction(body.action, body.payload || {}));
    }

    if (req.method === "POST" && req.url === "/api/config/model") {
      if (!validateAuth(req)) {
        return json(res, 401, { ok: false, message: "Unauthorized" });
      }
      const body = await readBody(req);
      return json(res, 200, await saveModelConfig(body));
    }

    if (req.method === "POST" && req.url === "/api/config/feishu") {
      if (!validateAuth(req)) {
        return json(res, 401, { ok: false, message: "Unauthorized" });
      }
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
