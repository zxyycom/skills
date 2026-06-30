import fs from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

type SkillPackage = {
  name: string;
  directory: string;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

const crcTable: Uint32Array = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readSubmodulePaths(): Promise<string[]> {
  const gitmodulesPath = path.join(rootDir, ".gitmodules");
  const gitmodules = await fs.readFile(gitmodulesPath, "utf8");
  return [...gitmodules.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((match) => match[1]);
}

async function discoverSkills(): Promise<SkillPackage[]> {
  const skills: SkillPackage[] = [];
  const seenNames = new Set<string>();

  for (const submodulePath of await readSubmodulePaths()) {
    const skillRoot = path.join(rootDir, submodulePath, "skill");
    if (!await exists(skillRoot)) {
      throw new Error(`${submodulePath} must contain a skill/ directory`);
    }

    const entries = await fs.readdir(skillRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(skillRoot, entry.name);
      if (!await exists(path.join(skillDir, "SKILL.md"))) {
        continue;
      }

      if (seenNames.has(entry.name)) {
        throw new Error(`Duplicate skill package name: ${entry.name}`);
      }

      seenNames.add(entry.name);
      skills.push({ directory: skillDir, name: entry.name });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectSkillFiles(skillDir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(skillDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(skillDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSkillFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort((a, b) => toPosix(path.relative(skillDir, a)).localeCompare(toPosix(path.relative(skillDir, b))));
}

function createLocalHeader(fileName: string, crc: number, compressedSize: number, uncompressedSize: number): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const header = Buffer.alloc(30);

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressedSize, 18);
  header.writeUInt32LE(uncompressedSize, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);

  return Buffer.concat([header, name]);
}

function createCentralDirectoryHeader(
  fileName: string,
  crc: number,
  compressedSize: number,
  uncompressedSize: number,
  localHeaderOffset: number
): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const header = Buffer.alloc(46);

  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(33, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressedSize, 20);
  header.writeUInt32LE(uncompressedSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localHeaderOffset, 42);

  return Buffer.concat([header, name]);
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Buffer {
  const header = Buffer.alloc(22);

  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);

  return header;
}

async function buildZip(skill: SkillPackage): Promise<Buffer> {
  const files = await collectSkillFiles(skill.directory);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(skill.directory, filePath));
    const zipPath = `${skill.name}/${relativePath}`;
    const data = await fs.readFile(filePath);
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const localHeader = createLocalHeader(zipPath, checksum, compressed.length, data.length);
    const centralHeader = createCentralDirectoryHeader(zipPath, checksum, compressed.length, data.length, offset);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = createEndOfCentralDirectory(files.length, centralDirectory.length, centralDirectoryOffset);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

await fs.mkdir(distDir, { recursive: true });

for (const skill of await discoverSkills()) {
  const archive = await buildZip(skill);
  const outputPath = path.join(distDir, `${skill.name}.zip`);
  await fs.writeFile(outputPath, archive);
  console.log(`Packed ${skill.name} -> ${path.relative(rootDir, outputPath)} (${archive.length} bytes).`);
}
