import { spawn } from "node:child_process";
import path from "node:path";

type ProcessOptions = Readonly<{
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  reject?: boolean;
}>;

/** Every CLI process gets an unused fixture home unless its test selects another. */
export async function runProcess(
  program: string,
  args: readonly string[],
  options: ProcessOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const home = path.resolve(
    import.meta.dirname,
    "../../../../.log/video-tests/unused-home"
  );
  return new Promise((resolve, reject) => {
    const child = spawn(program, [...args], {
      cwd: options.cwd,
      env: { ...process.env, HOME: home, USERPROFILE: home, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 30_000
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal !== null || code === null) {
        reject(
          new Error(
            `fixture process did not exit normally: ${signal ?? "unknown"}; ${stderr}`
          )
        );
      } else if (code !== 0 && options.reject !== false) {
        reject(
          new Error(`fixture process failed with exit ${code}: ${stderr}`)
        );
      } else {
        resolve({
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          exitCode: code
        });
      }
    });
  });
}
