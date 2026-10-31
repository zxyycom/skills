### Case INDEX-PREPARED-SELECTED-001: 选择同步共用 baseline 与原生构建证明

Tests:
- `test:dc046d84d04eeb4f89f3a414f4074bfca6984a8e2a04ad847aff5de2b353535e`

Tags:
- `index-runtime`

Contract:
- selector 和 selected sync 可共用同阶段严格 baseline/native build，但最后 revision 独立重读。

Proves:
- 一次 baseline 与 native build 在消费后不再解析或提字段，最终 revision 仍读取一次。
