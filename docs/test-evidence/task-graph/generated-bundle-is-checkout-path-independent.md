### Case TASK-GRAPH-DISTRIBUTION-004: bundle 与 source map 不依赖 checkout 绝对路径

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated task graph bundle and source map are checkout-path independent`
- `bun test --test-name-pattern="^generated task graph bundle and source map are checkout-path independent$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-graph 的生成脚本必须在长度不同的 checkout 绝对路径下产生逐字节一致的 bundle 与 source map。
- 构建只对锁定的 `write-file-atomic@8.0.0` 唯一 `__filename` token 使用稳定模块路径；Bun 的 bundle/map debugId 必须先一致再成对移除，其他 source map 映射保持由 bundler 生成。

Proves:
- 两个不同长度的隔离源码与依赖树分别执行真实生成入口后，`task-graph.mjs` 与 `.map` 逐字节一致；制品不含 debugId，并包含稳定的 write-file-atomic 模块标识。
