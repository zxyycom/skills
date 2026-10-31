### Case GATE-GENERATED-TYPE-INPUTS-001: type-aware 输入保守包含分发 TypeScript

Tests:
- `test:5aec2f109aafd168930be2dc0406450a674e3bafa8fe7d1f6f1cf3c8339b0d79`

Tags:
- `repository-tooling`

Contract:
- typecheck/lint 包含当前 program 的分发 TS/MTS/manifest；format 不扩大为 program 读取。

Proves:
- 分别改生成 TS、声明 MTS 与 skill manifest 后 typecheck/lint 执行且 format 复用；观察范围为项目输入配置和执行选择。
