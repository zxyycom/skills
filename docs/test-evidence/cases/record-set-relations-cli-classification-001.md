### Case RECORD-SET-RELATIONS-CLI-CLASSIFICATION-001: 两域 set-relations 对输入形态错误保持一致分类

Tests:
- `test:3d1d9dc401a0040c24b77db88ec1c5791d603225cfaef4d50bb8da160103dc5b`
- `test:8d9d315a5fe4957c92c6f15f62255545fc3e06379de1cd00187337f05e2e9ac7`
- `test:d83ccdd15a3155755438c7005f07a2044704426075efae54f12f38cf2e462263`
- `test:ff900cc3d159664915ae6557b4147436a7988ae54cc9bb0087bddf28eeffb1f5`

Tags:
- `decision-records`
- `investigation-report`

Contract:
- Decision 与 Investigation 的 `set-relations` 对重复 source、组内重复 target、空分组、clear 混用与只含摘要按 CLI 参数错误分类；公开语法只保留目标参数。

Proves:
- Decision 与 Investigation 的同进程 CLI 对重复 source、组内重复 target、空分组、clear 混用与只含摘要均返回退出码 2、用法诊断和空 stdout；不构造记录集合。
- 同进程 CLI 将 `--relations-for` 在 evolve 与 set-relations 中按普通未知选项拒绝；set-relations help 只展示 `--source` 分组语法。
