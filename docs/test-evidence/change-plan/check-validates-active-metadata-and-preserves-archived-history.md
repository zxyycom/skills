### Case CHANGE-PLAN-CHECK-METADATA-001: 检查区分活动元数据与归档历史
Entry:
- `tools/change-plan/tests/check.test.ts > check validates active metadata and preserves archived history`
- `bun test --test-name-pattern="^check validates active metadata and preserves archived history$" ./tools/change-plan/tests/run.ts`
Contract:
- 活动 Change 通过规范或兼容 metadata 恢复 Draft/Plan 身份与基线；archived Change 由目录身份成立，不解析活动 metadata。
Proves:
- null-base Plan 产生 `base-commit-unavailable` 而非格式诊断；历史 `implementation` 与 `source: git-distance-v1` shelf 均投影为 Plan，缺失或含未知字段的活动 metadata 被拒绝，而无 metadata 的 archived Change 保持有效。
