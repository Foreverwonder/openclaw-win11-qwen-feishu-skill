const output = document.getElementById("output");
const statsGrid = document.getElementById("statsGrid");
const pathList = document.getElementById("pathList");
const memorySummary = document.getElementById("memorySummary");
const skillsList = document.getElementById("skillsList");
const docsList = document.getElementById("docsList");
const practiceList = document.getElementById("practiceList");
const warningsList = document.getElementById("warningsList");
const modelHistoryList = document.getElementById("modelHistoryList");
const modelForm = document.getElementById("modelForm");
const feishuForm = document.getElementById("feishuForm");
const autoRefreshToggle = document.getElementById("autoRefreshToggle");
const currentModelCard = document.getElementById("currentModelCard");
const saveAndTestBtn = document.getElementById("saveAndTestBtn");
const controlCenterLog = document.getElementById("controlCenterLog");
const gatewayLog = document.getElementById("gatewayLog");

function statusClass(ok, warn = false) {
  if (ok) return "status-pill status-ok";
  if (warn) return "status-pill status-warn";
  return "status-pill status-bad";
}

function setOutput(title, payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  output.textContent = `${title}\n\n${body}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function runAction(action, payload = {}) {
  setOutput("执行中…", { action, payload });
  const result = await api("/api/action", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  setOutput(`动作完成: ${action}`, result);
  await refresh();
}

function mask(secret) {
  if (!secret) return "";
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

function renderStats(status) {
  const memoryData = status?.raw?.memory?.data?.[0]?.status || {};
  const channelsData = status?.raw?.channels?.data?.channels?.feishu || {};
  const browserData = status?.raw?.browser?.data || {};
  const skills = status?.raw?.skills?.data?.skills || [];

  const cards = [
    {
      title: "Gateway",
      value: status.gateway.probe.ok ? "在线" : "离线",
      className: statusClass(status.gateway.probe.ok, !status.gateway.probe.ok),
      detail: `URL: ${status.gateway.url}`,
      note: `${status.gateway.bind || "-"} / ${status.gateway.authMode || "-"}`,
    },
    {
      title: "默认模型",
      value: status.modelConfig.primary || "未设置",
      className: statusClass(Boolean(status.modelConfig.primary), !status.modelConfig.primary),
      detail: `API: ${status.modelConfig.api || "-"}`,
      note: status.modelConfig.baseUrl || "未设置 Base URL",
    },
    {
      title: "记忆索引",
      value: `${memoryData.files || 0} 文件 / ${memoryData.chunks || 0} 块`,
      className: statusClass((memoryData.files || 0) > 0, true),
      detail: `Provider: ${memoryData.provider || "none"}`,
      note: status.memoryFolderExists ? "memory 目录已存在" : "memory 目录缺失",
    },
    {
      title: "飞书",
      value: channelsData.running ? "运行中" : "未运行",
      className: statusClass(channelsData.running, status.feishuConfig.enabled),
      detail: status.feishuConfig.appId || "未配置 App ID",
      note: status.feishuConfig.enabled ? "channel 已启用" : "channel 未启用",
    },
    {
      title: "浏览器",
      value: browserData?.running ? "已启动" : "未启动",
      className: statusClass(Boolean(browserData?.running), true),
      detail: browserData?.profileName || "默认 profile",
      note: browserData?.browserPath || "未读取到浏览器状态",
    },
    {
      title: "技能",
      value: `${skills.filter((item) => item.eligible).length} 可用`,
      className: statusClass(skills.length > 0, true),
      detail: `${skills.length} 个总技能`,
      note: "Codex skills 与 OpenClaw managed skills 分离",
    },
  ];

  statsGrid.innerHTML = cards.map((card) => `
    <article class="card">
      <h3>${card.title}</h3>
      <strong>${card.value}</strong>
      <span class="${card.className}">${card.value}</span>
      <p class="muted">${card.detail}</p>
      <p class="muted">${card.note}</p>
    </article>
  `).join("");
}

function renderCurrentModel(status) {
  currentModelCard.innerHTML = `
    <div><strong>当前默认模型</strong></div>
    <div class="muted">${status.modelConfig.primary || "未设置"}</div>
    <div class="muted">Base URL: ${status.modelConfig.baseUrl || "-"}</div>
    <div class="muted">API: ${status.modelConfig.api || "-"}</div>
  `;
}

function renderPaths(status) {
  pathList.innerHTML = Object.entries(status.paths).map(([label, value]) => `
    <div class="kv">
      <div><strong>${label}</strong></div>
      <code>${value}</code>
    </div>
  `).join("");
}

function renderMemory(status) {
  const raw = status?.raw?.memory?.data?.[0] || {};
  const issues = raw.scan?.issues || [];
  const providerReason = raw.status?.custom?.providerUnavailableReason || "";

  memorySummary.innerHTML = [
    ["Workspace", raw.status?.workspaceDir || status.paths.workspaceDir],
    ["数据库", raw.status?.dbPath || "未生成"],
    ["Provider", raw.status?.provider || "none"],
    ["当前文件数", `${raw.status?.files || 0}`],
    ["索引问题", issues.length ? issues.join(" | ") : "无"],
    ["Embedding 提示", providerReason || "当前用的是 FTS-only，本地检索仍可工作"],
  ].map(([key, value]) => `
    <div class="kv">
      <div><strong>${key}</strong></div>
      <div class="muted">${value}</div>
    </div>
  `).join("");
}

function renderSkills(status) {
  const skills = (status?.raw?.skills?.data?.skills || []).slice(0, 12);
  skillsList.innerHTML = skills.map((skill) => `
    <div class="skill-item">
      <div><strong>${skill.name}</strong> <span class="${statusClass(skill.eligible, !skill.eligible)}">${skill.eligible ? "可用" : "未就绪"}</span></div>
      <div class="muted">${skill.description || "无描述"}</div>
      <div class="muted">来源: ${skill.source || "-"}</div>
    </div>
  `).join("");
}

function renderDocs(status) {
  docsList.innerHTML = status.docs.map((doc) => `
    <div class="doc-item">
      <div><a href="${doc.url}" target="_blank" rel="noreferrer">${doc.title}</a></div>
      <div class="row"><button data-doc-url="${doc.url}">用直连模式打开</button></div>
    </div>
  `).join("");

  practiceList.innerHTML = status.bestPractices.map((item) => `<div class="practice-item">${item}</div>`).join("");
}

function renderWarnings(status) {
  const warnings = status.warnings || [];
  warningsList.innerHTML = warnings.length
    ? warnings.map((item) => `<div class="warning-item">${item}</div>`).join("")
    : `<div class="warning-item">当前没有新的高优先级告警。</div>`;
}

function renderModelHistory(status) {
  const history = status.history?.modelHistory || [];
  modelHistoryList.innerHTML = history.length
    ? history.map((item, index) => `
      <div class="history-item">
        <strong>${index + 1}. ${item.providerId}/${item.modelId}</strong>
        <div class="muted">${item.modelName || item.modelId}</div>
        <div class="muted">${item.savedAt || ""}</div>
        <div class="row">
          <button data-history-index="${index}">回填这个模型</button>
        </div>
      </div>
    `).join("")
    : `<div class="history-item">你保存过的模型会显示在这里。</div>`;
}

function renderLogs(status) {
  controlCenterLog.textContent = (status.logs?.controlCenter || []).join("\n") || "暂无日志";
  gatewayLog.textContent = (status.logs?.gatewaySupervisor || []).join("\n") || "暂无日志";
}

function fillForms(status) {
  modelForm.providerId.value = status.modelConfig.providerId || "qwen-coding-plan";
  modelForm.baseUrl.value = status.modelConfig.baseUrl || "";
  modelForm.api.value = status.modelConfig.api || "";
  modelForm.modelId.value = status.modelConfig.modelId || "";
  modelForm.modelName.value = status.modelConfig.modelName || "";
  modelForm.apiKey.value = "";
  modelForm.apiKey.placeholder = status.modelConfig.apiKeyMasked || "sk-...";
  modelForm.reasoning.checked = Boolean(status.modelConfig.reasoning);

  feishuForm.appId.value = status.feishuConfig.appId || "";
  feishuForm.appSecret.value = "";
  feishuForm.appSecret.placeholder = status.feishuConfig.appSecretMasked || "secret";
  feishuForm.enabled.checked = Boolean(status.feishuConfig.enabled);
}

async function refresh() {
  const status = await api("/api/status");
  renderStats(status);
  renderCurrentModel(status);
  renderPaths(status);
  renderMemory(status);
  renderSkills(status);
  renderDocs(status);
  renderWarnings(status);
  renderModelHistory(status);
  renderLogs(status);
  fillForms(status);
  setOutput("状态已刷新", {
    generatedAt: status.generatedAt,
    gateway: status.gateway.probe,
    model: status.modelConfig.primary,
    skills: (status.raw.skills.data?.skills || []).length,
    feishu: status.raw.channels.data?.channels?.feishu || null,
  });
}

document.getElementById("refreshBtn").addEventListener("click", refresh);
document.getElementById("refreshChannelsBtn").addEventListener("click", refresh);

document.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  const docUrl = event.target.dataset.docUrl;
  const presetModel = event.target.dataset.presetModel;
  const presetName = event.target.dataset.presetName;
  const historyIndex = event.target.dataset.historyIndex;
  if (action) {
    try {
      await runAction(action);
    } catch (error) {
      setOutput(`动作失败: ${action}`, error.message || String(error));
    }
  }
  if (docUrl) {
    try {
      await runAction("openDocs", { url: docUrl });
    } catch (error) {
      setOutput("打开文档失败", error.message || String(error));
    }
  }

  if (presetModel) {
    modelForm.modelId.value = presetModel;
    modelForm.modelName.value = presetName || presetModel;
    setOutput("已填入模型预设", {
      modelId: presetModel,
      modelName: presetName || presetModel,
      nextStep: "现在直接点“保存模型配置”，再点“测试模型”即可。",
    });
  }

  if (historyIndex !== undefined) {
    try {
      const status = await api("/api/status");
      const picked = status.history?.modelHistory?.[Number(historyIndex)];
      if (picked) {
        modelForm.providerId.value = picked.providerId || "qwen-coding-plan";
        modelForm.baseUrl.value = picked.baseUrl || "";
        modelForm.api.value = picked.api || "";
        modelForm.modelId.value = picked.modelId || "";
        modelForm.modelName.value = picked.modelName || picked.modelId || "";
        modelForm.reasoning.checked = Boolean(picked.reasoning);
        setOutput("已回填历史模型", {
          providerId: picked.providerId,
          modelId: picked.modelId,
          modelName: picked.modelName,
          nextStep: "现在点“保存模型配置”，即可切回这个模型。",
        });
      }
    } catch (error) {
      setOutput("回填历史模型失败", error.message || String(error));
    }
  }
});

async function submitModelForm({ testAfterSave = false } = {}) {
  const payload = {
    providerId: modelForm.providerId.value.trim(),
    baseUrl: modelForm.baseUrl.value.trim(),
    api: modelForm.api.value.trim(),
    modelId: modelForm.modelId.value.trim(),
    modelName: modelForm.modelName.value.trim(),
    apiKey: modelForm.apiKey.value.trim(),
    reasoning: modelForm.reasoning.checked,
  };
  try {
    setOutput("保存模型配置中…", { ...payload, apiKey: mask(payload.apiKey) });
    const result = await api("/api/config/model", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const summary = {
      providerId: payload.providerId,
      modelId: payload.modelId,
      modelName: payload.modelName,
      validation: result.stdout || result.message || result,
      nextStep: testAfterSave ? "正在继续执行模型测试。" : "如果要确认联通性，直接点“测试模型”。",
    };
    setOutput("模型配置已保存", summary);
    if (testAfterSave) {
      const testResult = await api("/api/action", {
        method: "POST",
        body: JSON.stringify({ action: "testModel", payload: {} }),
      });
      setOutput("保存并测试完成", {
        ...summary,
        test: testResult.stdout || testResult.message || testResult,
      });
    }
    await refresh();
  } catch (error) {
    setOutput("模型配置保存失败", error.message || String(error));
  }
}

modelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitModelForm({ testAfterSave: false });
});

saveAndTestBtn.addEventListener("click", async () => {
  await submitModelForm({ testAfterSave: true });
});

feishuForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    appId: feishuForm.appId.value.trim(),
    appSecret: feishuForm.appSecret.value.trim(),
    enabled: feishuForm.enabled.checked,
  };
  try {
    setOutput("保存飞书配置中…", { ...payload, appSecret: mask(payload.appSecret) });
    const result = await api("/api/config/feishu", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setOutput("飞书配置已保存", result);
    await refresh();
  } catch (error) {
    setOutput("飞书配置保存失败", error.message || String(error));
  }
});

refresh().catch((error) => {
  setOutput("首次加载失败", error.message || String(error));
});

setInterval(() => {
  if (autoRefreshToggle.checked) {
    refresh().catch((error) => {
      setOutput("自动刷新失败", error.message || String(error));
    });
  }
}, 30000);
