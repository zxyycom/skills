### Case INDEX-PREPARED-SELECTED-001: 选择同步共用 baseline 与原生构建证明

Tests:
- `test:5df7831af00e68a709b9b56462c3873a9a4d55a1c05313cd4a5f736289aecd71`

Tags:
- `index-runtime`

Contract:
- selector 和 selected sync 可共用同阶段严格 baseline/native build，但最后 revision 独立重读。

Proves:
- 一次 baseline 与 native build 在消费后不再解析或提字段，最终 revision 仍读取一次。
