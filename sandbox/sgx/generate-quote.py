#!/usr/bin/env python3
"""
SGX DCAP Quote Generator for Agent Shenji

Runs inside a Gramine SGX enclave. Reads an AttestationRequest from stdin,
computes report_data = sha256(eventKey + manifestHash + evidenceRoot),
obtains a real DCAP quote via Gramine's /dev/attestation interface,
and outputs an AttestationResponse JSON to stdout.

Protocol (stdin/stdout JSON):
  Input:  AttestationRequest  { schemaVersion, eventKey, tokenId, manifestHash, evidenceRoot, manifestUrl }
  Output: AttestationResponse { measurement, quoteFormat, sessionPublicKey, quote }
"""

import json
import sys
import hashlib


SCHEMA_VERSION = "audit-attestation-request.v1"
QUOTE_FORMAT = "sgx-dcap-v3"
REPORT_DATA_SIZE = 64  # SGX report_data is 64 bytes


def require_string(obj, field):
    value = obj.get(field)
    if not isinstance(value, str) or value.strip() == "":
        raise ValueError(f"{field} is required and must be a non-empty string")
    return value


def parse_request(raw):
    parsed = json.loads(raw)
    if parsed.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"schemaVersion must be {SCHEMA_VERSION}")
    return {
        "schemaVersion": SCHEMA_VERSION,
        "eventKey": require_string(parsed, "eventKey"),
        "tokenId": require_string(parsed, "tokenId"),
        "manifestHash": require_string(parsed, "manifestHash"),
        "evidenceRoot": require_string(parsed, "evidenceRoot"),
        "manifestUrl": require_string(parsed, "manifestUrl"),
    }


def compute_report_data(request):
    """
    Compute the 64-byte report_data for SGX.
    First 32 bytes = SHA-256(eventKey + manifestHash + evidenceRoot)
    Last 32 bytes = zeros (reserved)
    """
    payload = request["eventKey"] + request["manifestHash"] + request["evidenceRoot"]
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return digest + b"\x00" * (REPORT_DATA_SIZE - len(digest))


def write_report_data(report_data):
    """Write report_data to Gramine's attestation device."""
    with open("/dev/attestation/user_report_data", "wb") as f:
        f.write(report_data)


def read_sgx_quote():
    """Read the DCAP quote from Gramine's attestation device."""
    with open("/dev/attestation/quote", "rb") as f:
        return f.read()


def read_mrenclave():
    """
    Read MRENCLAVE from Gramine's target info device.
    The first 32 bytes of my_target_info contain the MRENCLAVE measurement.
    """
    with open("/dev/attestation/my_target_info", "rb") as f:
        target_info = f.read()
    return target_info[:32].hex()


def main():
    raw_input = sys.stdin.read()
    request = parse_request(raw_input)

    # 1. Compute report_data binding our audit context
    report_data = compute_report_data(request)

    # 2. Write report_data to Gramine attestation device
    write_report_data(report_data)

    # 3. Read DCAP quote (triggers EREPORT → QE → quote generation)
    quote_bytes = read_sgx_quote()

    # 4. Read MRENCLAVE measurement
    mrenclave = read_mrenclave()

    # 5. Output response
    response = {
        "measurement": mrenclave,
        "quoteFormat": QUOTE_FORMAT,
        "sessionPublicKey": report_data[:32].hex(),
        "quote": quote_bytes.hex(),
    }

    json.dump(response, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"{e}\n")
        sys.exit(1)
