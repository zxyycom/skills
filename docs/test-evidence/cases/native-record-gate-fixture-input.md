### Case NATIVE-RECORD-GATE-FIXTURE-INPUT-001: Rust 外部测试 fixture 的精确输入闭包

Tests:
- `test:aad270c2ed75b80d4f42d5496a994e1abbedcb95a5b31b84fe5298ee704b6333`

Tags:
- `record-rust`

Contract:
- Cargo 测试读取的外部 fixture 变化须使对应测试证明失效，且不扩大 Rust 指标源码投影。

Proves:
- 私有 Git fixture 验证该路径激活 Cargo 测试、无关测试继续复用，并核对指标路径包含 Rust 工具及原生准备/调度自身，不把外部 fixture 纳入指标范围。
