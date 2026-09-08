### Case INVESTIGATION-CLI-LIST-001: CLI list returns a current report after resource byte changes

Tests:
- `test:da6235c4b442d3cb80c97cd0705da1a6ea4eacde8c0942aca9f7f183ec2ee57b`

Tags:
- `investigation-report`

Contract:
- 资源字节变化不使报告 index 过期，直接调用的源码 CLI 入口 `list` 继续可查询当前报告。

Proves:
- 在真实资源字节先后不同的 fixture 上，`list` 成功、stderr 为空且 stdout 返回紧凑报告定位行。
