### Case TEST-EVIDENCE-DISTRIBUTED-CLI-001: 分发模块与 CLI 保持 Topic 查询契约
Entry:
- `tools/test-evidence/tests/run.ts > distributed module and CLI preserve catalog query contracts`
- `bun test --test-name-pattern="^distributed module and CLI preserve catalog query contracts$" ./tools/test-evidence/tests/run.ts`
Contract:
- 分发模块和 CLI 必须与维护源码共享 topic 表、catalog 查询及不可恢复失败语义。
Proves:
- 分发 API 不再暴露配置 Schema，topic 查询与其他 Schema 可用，`topics` 和 `list` 返回 v4 结果，不可读固定索引在 `list` 与 `show` 中都以失败退出。
