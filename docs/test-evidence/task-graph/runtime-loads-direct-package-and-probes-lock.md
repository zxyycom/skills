### Case TASK-GRAPH-RUNTIME-PROBE-003: runtime 加载固定直接包并通过真实锁探针

Entry:
- `tools/task-graph/tests/runtime.test.ts > runtime loads the exact direct package and passes a real native lock probe`
- `bun test --test-name-pattern="^runtime loads the exact direct package and passes a real native lock probe$" ./tools/task-graph/tests/run.ts`

Contract:
- caller-provisioned runtime 只有直接 `fs-native-extensions@1.5.0` 可加载、API 完整且无争用 tryLock/unlock 真实探针成功时才 compatible。

Proves:
- 独立 Node 进程从固定 runtime 目录加载 addon，info 返回 compatible，mutation binding 同时暴露可调用的 tryLock 与 unlock。
