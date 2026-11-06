### Case NATIVE-RECORD-GATE-RUST-METRICS-001: Rust 源码与函数指标实际覆盖

Tests:
- `test:1122cc9732fbfeea962debf6f45ce1958513c6942c503b4623caffbf610fbb5f`
- `test:7aa93131136f2550f3ea0ea77c38d3d92b77b233cae1b493078418986e4b7a34`
- `test:9a35479cc62e2fe0c2368359e597c97e27c6dbab4de31bc8f36ea90d2e4b847f`
- `test:c8a86e4fe728c2a401f5a0d28a54ba1fc20099d3d62f38177932a72f16626948`
- `test:dfc9250a9dc0252eb10abd7e4541799ef6a9d21796a7bb5a2c75123f8bc3f42d`

Tags:
- `record-rust`

Contract:
- Rust code scope 须采集真实 Rust 源并按语言边界应用阻断指标。

Proves:
- 隔离 Rust 样本验证文件和函数采集、字符串、参数、错误传播及深度分析。
