### Case TEST-EVIDENCE-TOPIC-CLI-001: 未知与重复 Topic 参数确定失败
Entry:
- `tools/test-evidence/tests/catalog.test.ts > unknown and repeated topic CLI arguments fail deterministically`
- `bun test --test-name-pattern="^unknown and repeated topic CLI arguments fail deterministically$" ./tools/test-evidence/tests/catalog.test.ts`
Contract:
- Topic 过滤只接受一个已定义 ID，公共 API 与 CLI 必须返回稳定失败语义。
Proves:
- 未知 topic 返回 `query.topic-unknown` 与 CLI 退出码 2，重复 `--topic` 参数被确定拒绝。
