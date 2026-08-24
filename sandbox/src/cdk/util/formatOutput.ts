/**
 * 这里集中定义 CDK 的 ANSI 文本装饰与 stdout/stderr 输出约定，使命令层保持一致的人机界面；不判断业务成功、退出码或终端能力。
 * 输入均为已形成的显示字符串，输出要么是带复位码的字符串，要么直接写入当前进程流；不会访问文件、网络或共享持久状态。
 * 颜色函数必须始终追加 RESET，避免样式泄漏到后续日志；错误固定写 stderr，其余诊断写 stdout，这是脚本消费者依赖的兼容边界。
 * 写流是同步发起且无内部缓冲协调，并发调用可能按 Node 流语义交错；需要原子多行输出的调用方应在传入前自行组装。
 */
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
