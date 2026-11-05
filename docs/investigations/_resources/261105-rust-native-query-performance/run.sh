#!/bin/bash
set -euo pipefail
D=/workspace/skills/tools/decision-records/experiments/rust-native-cli/bench
R=/tmp/decision-records-rust-target/release/decision-records-rust-experiment
U=/tmp/decision-bench-usage
O=/tmp/decision-bench-final-results
run_unit() {
  local label=$1 root=$2 binary=$3 diff=$4 case=$5 mode
  for mode in wall resources; do
    echo "START $(date -u +%FT%TZ) $label $case $mode"
    python3 "$D/measure.py" --root "$root" --rust "$binary" --usage "$U" --diff "$diff" --case "$case" --measurement "$mode" --pairs 10 --output "$O/$label-$case-$mode.json"
    python3 "$D/summarize.py" "$O/$label-$case-$mode.json" > "$O/$label-$case-$mode-summary.json"
    echo "DONE $(date -u +%FT%TZ) $label $case $mode"
  done
}
for n in 100 1000 10000; do
 case "$n" in 100) root=/tmp/decisions-bench-100-22269; diff=/tmp/dr-final-100.json;; *) root=/tmp/decision-rust-bench-$n; diff=/tmp/dr-final-$n.json;; esac
 for case in page metadata-zero content-zero content-dense; do run_unit "$n" "$root" "$R" "$diff" "$case"; done
done
for case in real-list real-metadata real-content real-reallocation real-relations; do run_unit real /tmp/decision-rust-bench-real "$R" /tmp/dr-final-real-v2.json "$case"; done
run_unit unicode /tmp/decision-rust-variants-v2/unicode "$R" /tmp/dr-final-unicode.json unicode-preview
run_unit npm /tmp/decisions-bench-100-22269 /tmp/dr-final-smoke.VkD8w1/node_modules/.bin/dr-experiment /tmp/dr-final-npm.json metadata-zero
run_unit local /tmp/decisions-bench-100-22269 /tmp/dr-final-smoke.VkD8w1/installed /tmp/dr-final-installed.json metadata-zero
