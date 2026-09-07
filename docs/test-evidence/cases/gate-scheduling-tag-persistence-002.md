### Case GATE-SCHEDULING-TAG-PERSISTENCE-002: completed 时长提示按 active tag 集合保存并用于后续 Definition

Tests:
- `test:525c5304d9b56034690411d8244cb9dcc99588655f7ec097bffa5b2ec1294e56`

Tags:
- `repository-tooling`

Contract:
- base 与 release tag 独立保存当前 active Check 的有限非负时长；关键路径排序只要求 active executable Check 具有完整提示，未激活 Check 保留在完整 Definition 中但不影响 admission。未知 Check、损坏或不完整的 active 提示不改变 Gate 结算，并回退声明顺序。

Proves:
- release 写入不会覆盖 base 提示；base 的完整 active hint 会实际改变 active admission 顺序，release-only catalog Check 仍保留且顺序不变；损坏 base 文件会被忽略。
