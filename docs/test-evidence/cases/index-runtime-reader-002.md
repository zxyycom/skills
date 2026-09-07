### Case INDEX-RUNTIME-READER-002: 冻结 runtime reader 元数据且不重复验证查询覆盖

Tests:
- `test:c22dc6adf3c89fa06c9739805027164882da973cc3bd0046fe701c848dfd4eac`

Tags:
- `index-runtime`

Contract:
- 已打开 reader 的 metadata 必须为稳定只读快照，ID-keyed 查询覆盖不得重新验证完整静态索引。

Proves:
- 外部源修改和强制写入不能改变 reader 元数据，普通查询与覆盖查询不增加完整索引验证次数。
