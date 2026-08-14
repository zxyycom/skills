### Case INVESTIGATION-RESOURCE-IGNORE-001: Git ignore 排除未跟踪噪声但保留已跟踪资源

Entry:
- `tools/investigation-report/tests/resources.test.ts > Git ignore rules exclude untracked noise but retain tracked resources`
- `bun test --test-name-pattern="^Git ignore rules exclude untracked noise but retain tracked resources$" ./tools/investigation-report/tests/run.ts`

Contract:
- Git 工作区只把版本控制可见文件作为受管调查资源；ignore 排除的未跟踪文件不参与孤儿检查、metadata 或 source revision，已跟踪文件即使后来命中 ignore 仍继续受管。

Proves:
- `__pycache__/*.pyc` 与另一个被 ignore 的未跟踪资源不会导致完整检查失败，也不会进入资源 metadata。
- 已提交后才命中 ignore 的资源与普通可见资源继续进入 metadata；只改变被忽略缓存的字节不会改变结构化来源 revision。
