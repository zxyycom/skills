#!/usr/bin/env bash
# Fresh output directory is required; never overwrites an existing evidence run.
set -euo pipefail
repo=${1:-/workspace/skills}
version=eea1d03e3429f83797e660d75326e0ebd752f61d
source_dir=$(cd -- "$(dirname -- "$0")" && pwd)
output=$(mktemp -d /tmp/remaining-evidence-replay-XXXXXX)
printf 'Replay directory: %s\n' "$output"
cp "$source_dir"/probe-{domain,small,files,longline}.mjs "$source_dir/setup-instrumentation.py" "$output/"
mkdir "$output/baseline"
git -C "$repo" archive "$version" tools package.json skills/decision-records/references skills/investigation-report/references | tar -x -C "$output/baseline"
ln -s "$repo/node_modules" "$output/baseline/node_modules"
python "$output/setup-instrumentation.py"
node "$output/probe-domain.mjs" | tee "$output/domain-run.stdout"
node "$output/probe-small.mjs" | tee "$output/small-run.stdout"
node "$output/probe-files.mjs" | tee "$output/files-run.stdout"
node "$output/probe-longline.mjs" | tee "$output/longline-run.stdout"
printf 'All isolated probes passed: %s\n' "$output"
