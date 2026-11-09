### Case NATIVE-OVERLAY-CLEANUP-001: 原生覆盖清理失败的状态诊断

Tests:
- `test:1ea0d1434cb12240f4dbe569ba632f33d04dbd402baccb93d8086283f33dff2b`
- `test:5df8dd4ea94214d3f068c68ccba2506162dbd0863085cc97d5a3baf648a30a94`
- `test:70ad221e381f2e56fdcd8b99fc75323e6e14b03eced24f54b9a505a20e5e3c1d`

Tags:
- `repository-tooling`

Contract:
- 清理失败须保留主失败，报告残留路径并区分已安装状态。

Proves:
- 注入暂存清理和目录清理错误，诊断包含主失败、路径与原因；安装成功后的清理故障明确报告已安装，文件和残留暂存目录仍可观察。
