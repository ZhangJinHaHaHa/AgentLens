/**
 * 本模块拥有交互式 readline 会话的创建与释放，并提供一次性提问/确认便利函数；不校验回答的领域含义，也不设置进程退出状态。
 * 输入输出流可注入以支持测试或非标准终端，回答会去除首尾空白，确认仅接受 y/yes；stdin 内容属于不可信用户输入。
 * 创建会话会注册流监听并占用进程资源，调用方必须最终 close；一次性 API 在正常完成后关闭，但底层流错误仍按 Promise 失败语义传播。
 * 同一 PromptSession 预期串行提问，未定义并发 question 的次序；默认否定及大小写处理是 CLI 自动化可依赖的兼容不变量。
 */
import readline from "node:readline";

export interface PromptUserOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface PromptSession {
  ask(question: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  close(): void;
}

export function createPromptSession(options: PromptUserOptions = {}): PromptSession {
  const rl = readline.createInterface({
    input: options.input ?? process.stdin,
    output: options.output ?? process.stdout
  });

  return {
    ask(question: string): Promise<string> {
      return new Promise<string>((resolve) => {
        rl.question(question, (answer) => {
          resolve(answer.trim());
        });
      });
    },
    confirm(message: string): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
          const trimmed = answer.trim().toLowerCase();
          resolve(trimmed === "y" || trimmed === "yes");
        });
      });
    },
    close(): void {
      rl.close();
    }
  };
}

export async function promptUser(
  question: string,
  options: PromptUserOptions = {}
): Promise<string> {
  const session = createPromptSession(options);
  const answer = await session.ask(question);
  session.close();
  return answer;
}

export async function promptConfirm(
  message: string,
  options: PromptUserOptions = {}
): Promise<boolean> {
  const session = createPromptSession(options);
  const result = await session.confirm(message);
  session.close();
  return result;
}
