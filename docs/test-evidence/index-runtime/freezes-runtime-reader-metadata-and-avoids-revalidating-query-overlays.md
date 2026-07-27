### Case INDEX-RUNTIME-READER-002: 冻结 runtime reader 元数据且不重复验证查询覆盖
Entry:
- `tools/index-runtime/tests/runtime.test.ts > freezes runtime reader metadata and avoids revalidating query overlays`
- `bun test --test-name-pattern="^freezes runtime reader metadata and avoids revalidating query overlays$" ./tools/index-runtime/tests/run.ts`
Contract:
- 已打开 reader 的元数据必须为稳定只读快照，查询覆盖不得重新验证完整静态索引。
Proves:
- 外部源修改和强制写入不能改变 reader 元数据，普通查询与覆盖查询不增加完整索引验证次数。
