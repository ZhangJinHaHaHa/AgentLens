import { readFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_MODEL = "MiniMax-M2.7";

export function resolveMiniMaxConfig(env = process.env) {
  return {
    baseUrl: trimTrailingSlash(env.MINIMAX_API_BASE_URL || DEFAULT_BASE_URL),
    model: env.MINIMAX_API_MODEL || DEFAULT_MODEL
  };
}

export async function readMiniMaxApiKey(env = process.env) {
  if (typeof env.MINIMAX_API_KEY === "string" && env.MINIMAX_API_KEY.trim()) {
    return env.MINIMAX_API_KEY.trim();
  }

  if (typeof env.MINIMAX_API_KEY_FILE === "string" && env.MINIMAX_API_KEY_FILE.trim()) {
    const raw = await readFile(env.MINIMAX_API_KEY_FILE.trim(), "utf8");
    return parseKeyFile(raw);
  }

  return "";
}

export function buildMiniMaxChatPayload({ query, locale, taxonomy, model }) {
  return {
    model,
    messages: [
      {
        role: "system",
        content: [
          "You translate a user's natural-language need into AgentLens catalog filters.",
          "Return JSON only. Do not recommend agents directly.",
          "Use only values from the provided taxonomy. Unknown values must be omitted.",
          "Only set hasAudit, hasOnboarding, riskLevels, or complexities when the user explicitly asks for those constraints.",
          "Do not infer audit, onboarding, risk, or complexity merely because a task sounds important.",
          "If you emit a visible <think> block, keep it short and still include the JSON object after it.",
          "Do not wrap the final JSON object in Markdown fences.",
          "Schema: scenarioIds:string[], tags:string[], accessTypes:string[], riskLevels:string[], complexities:string[], hasAudit:boolean, hasOnboarding:boolean, confidence:number, unmatchedTerms:string[].",
          "confidence must be a number from 0 to 1."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          locale,
          query,
          taxonomy
        })
      }
    ],
    temperature: 0,
    max_tokens: 1024,
    response_format: { type: "json_object" }
  };
}

export function extractMiniMaxContent(data) {
  if (data?.error) {
    const message = typeof data.error.message === "string" ? data.error.message : JSON.stringify(data.error);
    throw new Error(`MiniMax API error: ${message}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("MiniMax response did not include chat completion content.");
  }
  return content;
}

export function parseMiniMaxJsonContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const jsonText = extractFirstJsonObject(content);
    if (!jsonText) {
      throw new Error("MiniMax response did not include a JSON object.");
    }
    return JSON.parse(jsonText);
  }
}

export function createLlmNeedProxyPlugin() {
  return {
    name: "agentlens-llm-need-proxy",
    configureServer(server) {
      server.middlewares.use("/api/llm/parse-need", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const apiKey = await readMiniMaxApiKey();
          if (!apiKey) {
            sendJson(res, 503, {
              ok: false,
              error: "MiniMax API key is not configured for the local dev proxy."
            });
            return;
          }

          const body = await readJsonBody(req);
          const query = typeof body.query === "string" ? body.query.trim() : "";
          if (!query) {
            sendJson(res, 400, { ok: false, error: "query is required." });
            return;
          }

          const taxonomy = normalizeTaxonomy(body.taxonomy);
          const locale = body.locale === "en" ? "en" : "zh";
          const config = resolveMiniMaxConfig();
          const payload = buildMiniMaxChatPayload({ query, locale, taxonomy, model: config.model });
          const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            sendJson(res, response.status, {
              ok: false,
              error: "MiniMax API request failed."
            });
            return;
          }

          const content = extractMiniMaxContent(data);
          sendJson(res, 200, {
            ok: true,
            result: sanitizeLlmResult(parseMiniMaxJsonContent(content), taxonomy)
          });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "LLM need parser failed."
          });
        }
      });
    }
  };
}

function parseKeyFile(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  for (const line of lines) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key === "MINIMAX_API_KEY" && value) return value;
  }

  return lines.length === 1 ? lines[0] : "";
}

function extractFirstJsonObject(content) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return "";
}

function normalizeTaxonomy(value) {
  const record = isRecord(value) ? value : {};
  return {
    scenarioIds: stringArray(record.scenarioIds),
    tags: stringArray(record.tags),
    accessTypes: stringArray(record.accessTypes),
    riskLevels: stringArray(record.riskLevels),
    complexities: stringArray(record.complexities)
  };
}

function sanitizeLlmResult(value, taxonomy) {
  const record = isRecord(value) ? value : {};
  return {
    scenarioIds: allowlistedStrings(record.scenarioIds, taxonomy.scenarioIds),
    tags: allowlistedStrings(record.tags, taxonomy.tags),
    accessTypes: allowlistedStrings(record.accessTypes, taxonomy.accessTypes),
    riskLevels: allowlistedStrings(record.riskLevels, taxonomy.riskLevels),
    complexities: allowlistedStrings(record.complexities, taxonomy.complexities),
    hasAudit: record.hasAudit === true,
    hasOnboarding: record.hasOnboarding === true,
    confidence: normalizeConfidence(record.confidence),
    unmatchedTerms: stringArray(record.unmatchedTerms).slice(0, 8)
  };
}

function allowlistedStrings(value, allowed) {
  const allowedSet = new Set(allowed);
  return unique(stringArray(value)).filter((item) => allowedSet.has(item));
}

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeConfidence(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
