import type { CandidatePublishAsset } from "./candidate-publish.ts";

/** Produce exact-version bootstrap instructions from the already validated asset. */
export function candidateReleaseNotes(
  tag: string,
  assets: readonly CandidatePublishAsset[]
): string {
  const bootstrap = assets.find(
    (asset) => asset.name === "record-native-installer.zip"
  );
  if (!bootstrap || !/^sha256:[a-f0-9]{64}$/.test(bootstrap.digest))
    throw new Error("validated bootstrap digest missing");
  const hash = bootstrap.digest.slice(7);
  return `# Native record skill bootstrap

Requires GitHub CLI, Node.js >= 24.18, and pnpm 11.7.0. Choose the role and an explicit target directory; pause operations in an existing target during upgrade. The hash below binds this release's bootstrap bytes, not an independent signature.

## Linux x64 (Ubuntu 22.04 / glibc 2.35)

\`\`\`sh
set -eu
TAG=${tag}
gh release download "$TAG" --repo github.com/zxyycom/skills --pattern record-native-installer.zip --pattern skill-release-manifest.json
echo '${hash}  record-native-installer.zip' | sha256sum --check
node -e 'const m=require("./skill-release-manifest.json"); for (const r of ["decision-records","investigation-report"]) if(m.skills[r].native.bootstrap.sha256!=="${hash}") process.exit(1)'
unzip record-native-installer.zip
cd record-native-installer
pnpm install --frozen-lockfile
node scripts/decision-records.ts --target-dir /absolute/path/to/decision-records --release-tag "$TAG"
# Or: node scripts/investigation-report.ts --target-dir /absolute/path/to/investigation-report --release-tag "$TAG"
\`\`\`

## Windows x64 (MSVC)

\`\`\`powershell
$Tag = '${tag}'
gh release download $Tag --repo github.com/zxyycom/skills --pattern record-native-installer.zip --pattern skill-release-manifest.json
if ($LASTEXITCODE -ne 0) { throw 'release download failed' }
if ((Get-FileHash record-native-installer.zip -Algorithm SHA256).Hash.ToLower() -ne '${hash}') { throw 'bootstrap hash mismatch' }
$Manifest = Get-Content skill-release-manifest.json -Raw | ConvertFrom-Json
foreach ($Role in @('decision-records','investigation-report')) { if ($Manifest.skills.$Role.native.bootstrap.sha256 -ne '${hash}') { throw 'manifest bootstrap hash mismatch' } }
Expand-Archive record-native-installer.zip -DestinationPath .
Set-Location record-native-installer
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'dependency installation failed' }
node scripts/decision-records.ts --target-dir 'C:\\path\\to\\decision-records' --release-tag $Tag
if ($LASTEXITCODE -ne 0) { throw 'bootstrap failed' }
# Or: node scripts/investigation-report.ts --target-dir 'C:\\path\\to\\investigation-report' --release-tag $Tag
\`\`\`

Replace the example path before running. Installation asks for confirmation; use --check for a read-only preview. The installed native command works immediately; to run its independent updater, explicitly install dependencies in the installed skill directory with \`pnpm install --frozen-lockfile\`.
`;
}
