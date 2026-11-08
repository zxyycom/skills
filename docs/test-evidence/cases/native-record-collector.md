### Case NATIVE-RECORD-COLLECTOR-001: Cargo 原生测试实体采集

Tests:
- `test:6314a0ef63ea947e8e2a30bec20657177e50841568b085143bac523de54fedad`
- `test:7d64416438952d5100295605b714e508d842084977b12395528475d050836b16`
- `test:83eb671191e3cde8d96a939daca624fdca3fe61c37eeed04d8deeb7f74504b07`
- `test:ab0432d760d02d372ee9ca9e277a14a7f0a1519c0a261a5045399087bb703717`
- `test:d3087f26c86a701dbbae5bff031f718f46712dce70662346f5c34f198b7cb601`

Tags:
- `record-rust`

Contract:
- 实体快照须识别真实原生 target 与节点，来源指纹须覆盖原生测试 fixture，并拒绝不完整或畸形输入。

Proves:
- 私有 Cargo package 和坏消息验证节点、ignored、selector 与元数据；独立 fixture 变化更新 revision，无关 Markdown 不改变 revision；隔离子进程核对版本探测使用固定工具链参数，不证明 rustup 的实现。
