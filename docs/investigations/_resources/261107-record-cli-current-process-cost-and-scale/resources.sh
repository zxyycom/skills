#!/usr/bin/env bash
set -euo pipefail
base=/workspace/skills/dist/record-benchmarks/perf-261107-main
repo=/workspace/skills
native=/workspace/skills/dist/record-cli-perf-261107-main/assets/investigation-report
node=$(command -v node)
cli=/workspace/skills/skills/investigation-report/scripts/check-investigations.ts
collect="$base/collector"
printf '' > "$base/resource-samples.jsonl"
run(){ local label=$1 arm=$2 i=$3;shift 3; local r; r=$("$collect" "$@"); printf '{"scenario":"%s","arm":"%s","iteration":%d,"measurement":%s}\n' "$label" "$arm" "$i" "$r" >>"$base/resource-samples.jsonl"; }
printf '' > "$base/resource-calibration.jsonl"
for i in {1..5};do "$collect" /bin/true >> "$base/resource-calibration.jsonl"; "$collect" "$base/rss-calibration" >> "$base/resource-calibration.jsonl";done
for i in {1..5};do
 for arm in node native;do
  if [[ $arm == node ]];then prefix=("$node" "$cli"); else prefix=("$native");fi
  run help "$arm" "$i" "${prefix[@]}" --help
  for n in 1 5000;do
   root="$base/n$n"
   if [[ $arm == node ]];then run "list-$n" "$arm" "$i" "${prefix[@]}" --root "$root" list --limit 10; else run "list-$n" "$arm" "$i" "${prefix[@]}" list --limit 10 --root "$root" --json; fi
  done
  root="$base/n1200"
  if [[ $arm == node ]];then run content-1200 "$arm" "$i" "${prefix[@]}" --root "$root" search record-00007 --in content; else run content-1200 "$arm" "$i" "${prefix[@]}" search record-00007 --in content --root "$root" --json; fi
  for width in 8 2000;do
   if [[ $width == 8 ]];then root="$base/n5000"; anchor=260101-record-00025; budget=18;else root="$base/width2000"; anchor=260101-record-02017;budget=2010;fi
   if [[ $arm == node ]];then run "graph-$width" "$arm" "$i" "${prefix[@]}" --root "$root" trace "$anchor" --direction predecessors --depth all --max-records "$budget" --json; else run "graph-$width" "$arm" "$i" "${prefix[@]}" trace "$anchor" --direction predecessors --depth all --max-records "$budget" --json --root "$root";fi
  done
 done
done
printf 'PASS %s\n' "$(date -u +%FT%TZ)" > "$base/resources-complete.txt"
