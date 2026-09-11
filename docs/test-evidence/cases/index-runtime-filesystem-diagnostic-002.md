### Case INDEX-RUNTIME-FILESYSTEM-DIAGNOSTIC-002: 非文件系统 source 回调失败不虚构文件系统事实

Tests:
- `test:747600f28dcfe52e336acfdad52a4f334ad95d01f27f3d2ad604f1b9a829227e`

Tags:
- `index-runtime`

Contract:
- 只有已确认的 Node 文件系统错误才可附加 `filesystem`。一般 source 或 revision 回调异常（包括回调内的 abort 错误）保留稳定失败 code/message，不公开原始详情，也不改写为 operation-aborted。

Proves:
- source 与 revision 回调抛出的含凭据、绝对路径和换行的普通错误不进入诊断字段。
- 带 `ABORT_ERR` 的 source 回调异常仍为 `source-read-failed`，且不伪造 filesystem 或取消结果。
