export function formatTimestamp(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Unknown";
  }

  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(unixSeconds);
  }
}

export function truncateAddress(address: string, leading = 6, trailing = 4): string {
  if (address.length <= leading + trailing + 2) {
    return address;
  }

  return `${address.slice(0, leading)}...${address.slice(-trailing)}`;
}

export function formatScore(score: bigint | number): string {
  return String(Number(score));
}

export function formatBondWei(bond: bigint | number): string {
  const value = BigInt(bond);
  const eth = Number(value) / 1e18;

  if (eth >= 0.001) {
    return `${eth.toFixed(4)} ETH`;
  }

  return `${String(value)} wei`;
}

export function formatPriceEth(weiValue: bigint): string {
  const eth = Number(weiValue) / 1e18;

  if (eth === 0) {
    return "Free";
  }
  if (eth < 0.0001) {
    return `${weiValue.toString()} wei`;
  }
  if (eth >= 1) {
    return `${eth.toFixed(2)} ETH`;
  }
  if (eth >= 0.01) {
    return `${eth.toFixed(3)} ETH`;
  }
  return `${eth.toFixed(4)} ETH`;
}
