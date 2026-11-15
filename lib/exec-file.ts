import { spawn } from "node:child_process";

type ProcessOptions = { timeout: number; maxBuffer: number; signal?: AbortSignal };

// Python launches a Playwright driver and Chromium children. A process group is
// needed to cancel all of them; execFile ignores the detached spawn option.
export function execFileWithCleanup(file: string, args: string[], options: ProcessOptions) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    options.signal?.throwIfAborted();
    const grouped = process.platform !== "win32";
    const child = spawn(file, args, { detached: grouped, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    let killed = false;

    const terminate = () => {
      if (!child.pid) return;
      try {
        if (grouped) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") failure ??= error as Error;
      }
    };
    const stop = (error: Error) => {
      failure ??= error;
      killed = true;
      terminate();
    };
    const onAbort = () => {
      const error = new Error("The operation was aborted", { cause: options.signal?.reason });
      error.name = "AbortError";
      stop(error);
    };
    const timer = setTimeout(() => stop(new Error(`Process timed out after ${options.timeout}ms`)), options.timeout);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();

    const collect = (chunks: Buffer[], chunk: Buffer) => {
      const remaining = Math.max(0, options.maxBuffer - bytes);
      if (remaining) chunks.push(chunk.subarray(0, remaining));
      bytes += chunk.length;
      if (bytes > options.maxBuffer) stop(new Error(`Process output exceeded ${options.maxBuffer} bytes`));
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", (error) => { failure ??= error; });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      terminate();
      const output = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };
      if (failure || code !== 0) {
        reject(Object.assign(failure ?? new Error(`Process exited with code ${code}`), output, { code, signal, killed }));
      } else resolve(output);
    });
  });
}
