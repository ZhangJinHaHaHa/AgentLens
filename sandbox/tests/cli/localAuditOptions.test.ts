import test from "node:test";
import assert from "node:assert/strict";

import { createLocalAuditRunOptions } from "../../src/cli/localAuditOptions";
import { buildStandardAuditRequest } from "../../src/audit/buildStandardAuditRequest";
import { sendAuditRequest } from "../../src/audit/sendAuditRequest";
import {
  killContainer,
  pullImage,
  removeContainer,
  startContainer,
  stopContainer
} from "../../src/docker/dockerRunner";
import { waitForHealth } from "../../src/docker/healthcheck";
import { collectNetworkActivity } from "../../src/monitor/networkMonitor";
import { collectResourceUsage } from "../../src/monitor/resourceMonitor";

test("createLocalAuditRunOptions wires the local audit runtime to real implementations", () => {
  const options = createLocalAuditRunOptions("/tmp/manifest.json");
  const expectedRequest = buildStandardAuditRequest({
    taskId: "local-audit-task",
    history: []
  });

  assert.equal(options.manifestPath, "/tmp/manifest.json");
  assert.deepEqual(options.request, expectedRequest);
  assert.equal(options.pullImage, pullImage);
  assert.equal(options.startContainer, startContainer);
  assert.equal(options.waitForHealth, waitForHealth);
  assert.equal(options.sendAuditRequest, sendAuditRequest);
  assert.equal(options.collectResourceUsage, collectResourceUsage);
  assert.equal(options.collectNetworkActivity, collectNetworkActivity);
  assert.equal(options.killContainer, killContainer);
  assert.equal(options.stopContainer, stopContainer);
  assert.equal(options.removeContainer, removeContainer);
});
