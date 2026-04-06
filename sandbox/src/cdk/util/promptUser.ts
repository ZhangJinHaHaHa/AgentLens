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
