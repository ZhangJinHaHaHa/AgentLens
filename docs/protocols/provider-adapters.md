# Provider Adapter Contract

This document defines the public compatibility boundary between AgentLens and model or search providers. It is an integration contract, not a description of AgentLens production routing.

- Machine-readable schemas: [`schemas/`](schemas/)
- Public protocol index: [`README.md`](README.md)
- Live platform: [agentlens.chat](https://agentlens.chat/en)

Production endpoints, credentials, quotas, provider priority, routing weights, health thresholds, fallback order, internal prompts, and cost policy are intentionally private.

## Stable Platform IDs

The workspace and seller Agents use stable AgentLens model IDs. A provider adapter may map one platform ID to a supported upstream model alias, but upstream aliases must not become durable marketplace or project identifiers.

Each completed call records non-secret observability metadata:

- stable platform model ID;
- provider adapter family and adapter version;
- upstream model alias when disclosure is permitted;
- capability and conformance version;
- latency, normalized usage, and normalized finish reason;
- whether a fallback occurred and its non-sensitive reason category.

Changing an upstream alias must not silently change the declared capabilities of the platform model. An incompatible capability change requires a new platform model version or a failed-closed response.

## Canonical Model Request

Adapters accept a provider-neutral request composed from the public model and content-part schemas. The canonical request includes:

| Field | Meaning |
|---|---|
| `requestId` | Idempotency and trace identifier |
| `modelId` | Stable AgentLens model ID |
| `messages` | Ordered system, user, assistant, and tool messages |
| `content` | Typed text, image, file, or structured content parts |
| `tools` | Explicitly authorized tool definitions only |
| `toolChoice` | Normalized automatic, required, disabled, or named selection |
| `responseFormat` | Text or supported structured-output contract |
| `stream` | Whether normalized incremental events are requested |
| `budget` | Token, time, cost, and tool-call ceilings |
| `metadata` | Non-secret run, project, Agent, and trace references |

Provider credentials, capability-broker credentials, internal route candidates, and unrestricted network addresses are never part of the canonical request exposed to a seller Agent.

## Canonical Model Response

Every adapter normalizes upstream output into:

- assistant content parts;
- structured tool calls and tool-call IDs;
- finish reason;
- input, output, cached, and reasoning usage when the provider reports them;
- provider request reference when safe to retain;
- normalized warnings and fallback metadata;
- streaming events that can be replayed into the same final response.

Unknown upstream fields may be retained in a private diagnostic envelope, but must not alter public behavior without a protocol version change.

## OpenAI Responses Mapping

The OpenAI adapter maps canonical messages and content parts to the Responses API. It must:

1. preserve message ordering and system/developer intent;
2. map typed text, image, and file inputs without flattening file identity or hashes;
3. translate function tools to canonical tool calls and preserve call IDs;
4. normalize response output items and streaming deltas;
5. report usage and finish state without inventing unavailable counters;
6. fail closed when a requested capability is unsupported by the selected model.

Legacy Chat Completions behavior must not be selected as a silent fallback for a model declared as a Responses adapter.

## Anthropic Messages Mapping

The Anthropic adapter maps the canonical request to the Messages API. It must:

1. preserve the top-level system instruction separately from the user conversation;
2. map content blocks and tool-use/tool-result pairs without losing their IDs;
3. normalize streaming content, tool input deltas, stop reasons, and usage;
4. preserve supported image and document inputs as typed parts;
5. reject unsupported response-format or tool semantics explicitly.

Provider-native prompt caching or extended reasoning may be used only when declared by capability discovery; adapters must not claim usage fields that the upstream response did not provide.

## OpenAI-Compatible Mapping

An OpenAI-compatible adapter is a distinct adapter family, not proof of full OpenAI equivalence. Before a model is exposed, conformance tests must verify the exact features declared for it:

- system-message behavior;
- streaming and cancellation;
- tool calls and argument encoding;
- structured output;
- image and file inputs;
- usage accounting;
- error and rate-limit semantics.

Unsupported fields must be removed only when the public capability manifest declares them unsupported. They must never be silently ignored for a capability advertised as available.

## Search Adapter Boundary

Search adapters return candidates; they do not produce the final factual answer. A normalized result contains query identity, title, URL, snippet, provider rank, publication metadata when known, and retrieval time.

AgentLens remains responsible for:

- separating the requested deliverable from the research topic;
- query rewriting and bounded follow-up searches;
- page retrieval and deep reading;
- source relevance, authority, recency, and conflict checks;
- claim-to-evidence and artifact source maps;
- final citation validation.

The hosted deployment currently uses Tavily as its paid search provider. The public contract permits adapter replacement without changing seller Agent or workspace contracts. Search credentials stay server-side and are never written to browser storage, seller packages, runtime frames, logs, or artifacts.

## Capability Discovery and Conformance

Before enabling an adapter, AgentLens records a conformance result using `agentlens-model-provider-conformance.v1`. Tests cover declared input modes, streaming, tools, structured output, cancellation, timeout, malformed output, rate limits, authentication failure, and usage normalization.

A provider may be marked:

- `conformant`: all required tests pass;
- `degraded`: only explicitly optional capabilities are unavailable;
- `blocked`: a required capability or safety invariant fails.

Conformance is bound to the adapter version and upstream model alias. A changed alias or adapter requires revalidation.

## Normalized Failures

Adapters map upstream failures into stable categories:

| Category | Retry guidance |
|---|---|
| `authentication_failed` | Do not retry; operator action required |
| `permission_denied` | Do not retry under the same authorization |
| `unsupported_capability` | Fail closed or select an explicitly compatible model before charging |
| `invalid_request` | Do not retry unchanged input |
| `rate_limited` | Retry only within the run budget and provider guidance |
| `provider_unavailable` | Bounded retry or declared fallback |
| `timeout` | Bounded retry if idempotent |
| `content_blocked` | Return the provider-safe explanation; do not bypass policy |
| `malformed_response` | Reject the response and record adapter failure |
| `budget_exceeded` | Stop without additional provider calls |

Fallback is never silent. The run receipt identifies that fallback occurred, the reason category, the replacement platform model ID, and whether capabilities changed. A fallback that cannot preserve required capabilities is rejected before seller-Agent execution or additional charging.

## Credential and Data Rules

- Provider keys are loaded from server-side secret storage and are never accepted from public browser code.
- Seller Agents receive scoped capability grants, not platform provider keys.
- Logs and traces redact authorization headers, prompt secrets, signed URLs, files marked private, and webhook credentials.
- Provider requests obey the project retention and privacy policy declared to the user.
- Test fixtures use reserved example domains and synthetic credentials only.

## What This Contract Does Not Publish

The following remain private AgentLens implementation details:

- route ranking, quality weights, health thresholds, and model-selection prompts;
- provider account topology, endpoints, quotas, and negotiated pricing;
- search query scoring and private quality-gate thresholds;
- fallback ordering, cost controls, settlement ledgers, and production telemetry;
- capability-broker implementation, Worker placement, and production deployment topology.

This separation lets third-party Agents integrate against a stable, testable protocol without disclosing the platform's operating logic or infrastructure.
