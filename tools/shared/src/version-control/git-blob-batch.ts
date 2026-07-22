import { execFile } from "node:child_process";

const gitBatchOutputMaxBuffer = 256 * 1024 * 1024;

export async function readGitBlobs(
  rootDirectory: string,
  objectIds: readonly string[]
): Promise<ReadonlyMap<string, Buffer>> {
  const uniqueObjectIds = [...new Set(objectIds)];
  if (uniqueObjectIds.length === 0) {
    return new Map();
  }

  const output = await runGitBufferWithInput(
    rootDirectory,
    ["cat-file", "--batch"],
    `${uniqueObjectIds.join("\n")}\n`
  );
  const blobs = new Map<string, Buffer>();
  let offset = 0;

  for (const expectedObjectId of uniqueObjectIds) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd === -1) {
      throw new Error(`Missing Git blob header for ${expectedObjectId}`);
    }

    const header = output.subarray(offset, headerEnd).toString("utf8");
    const [objectId, objectType, sizeText, ...extraFields] = header.split(" ");
    const size = Number(sizeText);
    if (
      extraFields.length > 0
      || objectId !== expectedObjectId
      || objectType !== "blob"
      || !Number.isSafeInteger(size)
      || size < 0
    ) {
      throw new Error(`Unexpected Git blob header for ${expectedObjectId}`);
    }

    const dataStart = headerEnd + 1;
    const dataEnd = dataStart + size;
    if (dataEnd >= output.length || output[dataEnd] !== 0x0a) {
      throw new Error(`Truncated Git blob content for ${expectedObjectId}`);
    }

    blobs.set(objectId, output.subarray(dataStart, dataEnd));
    offset = dataEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error("Unexpected trailing Git blob batch output");
  }
  return blobs;
}

function runGitBufferWithInput(
  rootDirectory: string,
  args: readonly string[],
  input: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = execFile(
      "git",
      ["-C", rootDirectory, ...args],
      {
        encoding: null,
        maxBuffer: gitBatchOutputMaxBuffer,
        windowsHide: true
      },
      (error, stdout) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error !== null) {
          reject(error);
          return;
        }
        if (!Buffer.isBuffer(stdout)) {
          reject(new Error("Git did not return binary output"));
          return;
        }
        resolve(stdout);
      }
    );

    if (child.stdin === null) {
      settled = true;
      child.kill();
      reject(new Error("Git standard input is unavailable"));
      return;
    }
    child.stdin.on("error", (error) => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(error);
      }
    });
    child.stdin.end(input);
  });
}
