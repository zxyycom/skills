#!/usr/bin/env bash
set -euo pipefail
cd /tmp/record-tools-opt-round2.x9U7QL
for n in 1000 10000 100000; do
  for variant in before after; do
    timeout 300s node --max-old-space-size=4096 measure.ts "$variant" ir-evidence "$n" >> results/raw.jsonl
  done
done
for sample in 1 2 3; do
  # Alternate execution order to avoid always giving one variant a hotter filesystem.
  variants='before after'
  if [ "$sample" = 2 ]; then variants='after before'; fi
  for operation in decision-list decision-metadata ir-list; do
    for variant in $variants; do
      timeout 300s node --max-old-space-size=4096 measure.ts "$variant" "$operation" 100000 >> results/raw.jsonl
    done
  done
done
for variant in before after; do
  timeout 300s node --max-old-space-size=4096 measure.ts "$variant" decision-check 100000 >> results/raw.jsonl
done
