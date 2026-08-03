### Case DECISION-DOMAIN-CATALOG-REVISION-001: 领域目录 revision 忽略格式并跟踪描述
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > decision domain catalog revision ignores formatting but tracks descriptions`
- `bun test --test-name-pattern="^decision domain catalog revision ignores formatting but tracks descriptions$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策索引 revision 由规范领域值决定；常规列表读取持久快照，严格检查仍必须识别领域描述漂移。
Proves:
- 压缩 JSON 后 list 仍成功；修改描述后 domains 立即读取新目录值，list 保持旧快照，严格检查报告索引失效。
