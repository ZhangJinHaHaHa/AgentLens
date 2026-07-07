import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { SandboxManifest } from "../types/manifest";
import { fetchPublicHttpUrl } from "../security/publicHttpUrl";
import { validateManifest } from "./schema";

export class ManifestValidationError extends Error {
  readonly reasonCode = "MANIFEST_INVALID";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ManifestValidationError";
  }
}

function parseManifestContents(fileContents: string): SandboxManifest {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(fileContents);
  } catch (error) {
    throw new ManifestValidationError("Manifest file is not valid JSON", { cause: error });
  }

  try {
    return validateManifest(parsedJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manifest validation failed";
    throw new ManifestValidationError(message, { cause: error });
  }
}

type ManifestLocationKind = "remote" | "unsupported_url" | "local";

function getManifestLocationKind(value: string): ManifestLocationKind {
  try {
    const parsedUrl = new URL(value);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? "remote" : "unsupported_url";
  } catch {
    return "local";
  }
}

async function readManifestFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    throw new ManifestValidationError(`Unable to read manifest file: ${filePath}`, { cause: error });
  }
}

async function downloadManifestUrl(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<string> {
  try {
    const parsedUrl = new URL(manifestUrl);

    if (options.requireRemoteHttps && parsedUrl.protocol !== "https:") {
      throw new ManifestValidationError("Manifest URL must use https");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new ManifestValidationError("Manifest URL must use http or https");
    }

    const response = await fetchPublicHttpUrl(parsedUrl, {
      fetchImpl: options.fetchImpl,
      requireHttps: options.requireRemoteHttps
    });
    if (!response.ok) {
      throw new ManifestValidationError(
        `Unable to download manifest URL: HTTP ${response.status}`
      );
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      throw error;
    }

    throw new ManifestValidationError(`Unable to download manifest URL: ${manifestUrl}`, {
      cause: error
    });
  }
}

export interface LoadedManifestSource {
  manifest: SandboxManifest;
  manifestHash: string;
  sourceContents: string;
}

export interface LoadManifestSourceOptions {
  fetchImpl?: typeof fetch;
  allowLocalFile?: boolean;
  requireRemoteHttps?: boolean;
}

export async function loadManifestSource(
  manifestLocation: string,
  options: LoadManifestSourceOptions = {}
): Promise<LoadedManifestSource> {
  const locationKind = getManifestLocationKind(manifestLocation);
  if (locationKind === "unsupported_url") {
    throw new ManifestValidationError("Manifest URL must use http or https");
  }
  if (locationKind === "local" && options.allowLocalFile === false) {
    throw new ManifestValidationError("Manifest location must be an HTTPS URL");
  }

  const sourceContents =
    locationKind === "remote"
      ? await downloadManifestUrl(manifestLocation, options)
      : await readManifestFile(manifestLocation);
  const manifest = parseManifestContents(sourceContents);

  return {
    manifest,
    manifestHash: createHash("sha256").update(sourceContents).digest("hex"),
    sourceContents
  };
}

export async function loadManifest(filePath: string): Promise<SandboxManifest> {
  return (await loadManifestSource(filePath)).manifest;
}

export async function loadManifestFromUrl(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<SandboxManifest> {
  return (await loadManifestSource(manifestUrl, options)).manifest;
}

export async function loadAuditChainManifestSource(
  manifestUrl: string,
  options: LoadManifestSourceOptions = {}
): Promise<LoadedManifestSource> {
  return loadManifestSource(manifestUrl, {
    ...options,
    allowLocalFile: false,
    requireRemoteHttps: true
  });
}
