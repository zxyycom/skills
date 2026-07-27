### Case INDEX-RUNTIME-TEMPORAL-SORT-001: 跨时区偏移按时间点排序
Entry:
- `tools/index-runtime/tests/query.test.ts > sorts temporal keys by instants across timezone offsets`
- `bun test --test-name-pattern="^sorts temporal keys by instants across timezone offsets$" ./tools/index-runtime/tests/run.ts`
Contract:
- 时间键排序必须比较规范时间点而非原始文本。
Proves:
- 带偏移时间与 UTC 时间按真实先后顺序返回。
