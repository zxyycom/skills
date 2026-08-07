### Case TASK-GRAPH-DISTRIBUTION-004: 生成模块与声明树不依赖 checkout 绝对路径

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated task graph bundle and source map are checkout-path independent`
- `bun test --test-name-pattern="^generated task graph bundle and source map are checkout-path independent$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-graph 的生成脚本必须在长度不同的 checkout 绝对路径下产生逐字节一致的 bundle、source map、声明入口和完整声明树。
- 构建只对锁定的 `write-file-atomic@8.0.0` 唯一 `__filename` token 使用稳定模块路径；Bun 的 bundle/map debugId 必须先一致再成对移除，其他 source map 映射保持由 bundler 生成。
- 声明目录只保留当前公开入口可达的生成文件；额外文件必须让 `--check` 失败，并由 `--write` 清除。

Proves:
- 两个不同长度的隔离源码与依赖树分别执行真实生成入口后，`task-graph.mjs`、`.map`、根声明和声明树逐字节一致；制品不含 debugId，并包含稳定的 write-file-atomic 模块标识。注入 stale 声明后，check 拒绝该目录，write 删除额外文件。
