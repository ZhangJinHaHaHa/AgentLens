const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const RED = `${ESC}31m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const CYAN = `${ESC}36m`;

export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function red(text: string): string {
  return `${RED}${text}${RESET}`;
}

export function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

export function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

export function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}

export function printSuccess(message: string): void {
  process.stdout.write(`${green("✓")} ${message}\n`);
}

export function printError(message: string): void {
  process.stderr.write(`${red("✗")} ${message}\n`);
}

export function printInfo(message: string): void {
  process.stdout.write(`${cyan("ℹ")} ${message}\n`);
}

export function printWarning(message: string): void {
  process.stdout.write(`${yellow("⚠")} ${message}\n`);
}

export function printKeyValue(key: string, value: string, keyWidth: number = 20): void {
  const paddedKey = key.padEnd(keyWidth);
  process.stdout.write(`  ${dim(paddedKey)} ${value}\n`);
}

export function printHeader(title: string): void {
  process.stdout.write(`\n${bold(title)}\n${"─".repeat(title.length)}\n`);
}
