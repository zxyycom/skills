### Case DECISION-DOMAIN-CATALOG-REVISION-001: 领域目录 revision 忽略格式并跟踪描述
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > decision domain catalog revision ignores formatting but tracks descriptions`
- `bun test --test-name-pattern="^decision domain catalog revision ignores formatting but tracks descriptions$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策索引 revision 由规范领域值决定，纯 JSON 格式变化不失效索引，描述变化必须失效。
Proves:
- 压缩 JSON 后 list 仍成功，修改领域描述后 list 拒绝陈旧索引并报告 source revision。
