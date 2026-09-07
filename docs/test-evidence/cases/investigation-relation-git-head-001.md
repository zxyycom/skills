### Case INVESTIGATION-RELATION-GIT-HEAD-001: 全量检查仅提示尚未进入 Git HEAD 的直接前序

Tests:
- `test:6dde42925601d2cab5e8acd11e3dfb6f741af99bf423ab3ae8ab7836fb8a7abd`

Tags:
- `investigation-report`

Contract:
- 默认全量检查只对尚未进入 Git HEAD 的直接前序关系给出独立调查演进复核提示。

Proves:
- 三层关系中，只有以 `first-unrecorded.md` 和 `second-unrecorded.md` 为 target 的未进入 Git HEAD 直接关系产生提示；以 `recorded.md` 为 target 的 HEAD 内直接关系不提示，且不合成 `source.md` 指向 `first-unrecorded.md` 的间接关系提示。
