### Case TEST-EVIDENCE-CROSS-TOPIC-ID-001: Case ID 在全部 Topic 中唯一
Entry:
- `tools/test-evidence/tests/run.ts > catalog validation rejects duplicate case IDs across topics`
- `bun test --test-name-pattern="^catalog validation rejects duplicate case IDs across topics$" ./tools/test-evidence/tests/run.ts`
Contract:
- Case ID 是统一目录身份，不能在不同 topic 目录的单 case 文件中重复。
Proves:
- 两个 topic 声明相同 ID 时返回包含双方 `<topic>/<slug>.md` 源路径的 `catalog.case-id-duplicate` 诊断。
