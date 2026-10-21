### Case GATE-SNAPSHOT-FALLBACK-DIAGNOSTIC-SAFETY-001: 采集失败上下文与未闭合路径分开且安全公开

Tests:
- `test:06766f8b5d918e2859c0f09b1c2e13eb573bb785f9167569895680f4a7fb1616`

Tags:
- `repository-tooling`

Contract:
- 读取或工具探测失败继续使用 snapshot fallback；公开摘要保留可定位上下文，同时脱敏秘密、绝对路径并转义控制字符。

Proves:
- 读取失败与必要工具探测失败均保留各自上下文，machine 的 unclosedInputs 为 null，终端使用 Snapshot fallback 而非 Inputs unclosed。
- fallbackDetail 与 receipt publication detail 使用同一安全投影；命名秘密和 provider token 在紧邻 ESC 时仍脱敏，终端和 machine 均不含 fixture 密码、provider token、私密绝对路径或原始 ESC。
