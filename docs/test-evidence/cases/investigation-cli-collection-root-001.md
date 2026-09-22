### Case INVESTIGATION-CLI-COLLECTION-ROOT-001: 集合目录误传 --root 时给出恢复形态

Tests:
- `test:41eb956540294b8cd0b406989c5bb50834a37485b537235deef6e2de3317f336`

Tags:
- `investigation-report`

Contract:
- `--root` 指向当前配置的领域集合目录时，诊断基于实际配置目录给出 `--root <workspace> --investigations-dir <relative-collection>` 恢复形态；仅后缀相似的目录不触发该诊断，按普通集合缺失处理。

Proves:
- 默认 `docs/investigations` 与自定义 `--investigations-dir notes` 的误用分别得到对应目录的恢复参数，均以退出码 `2` 结束。
- `mydocs/investigations` 作为 root 不产生恢复诊断，check 以退出码 `1` 报告集合缺失。
