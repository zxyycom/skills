### Case DECISION-EVOLVE-GROUPED-SOURCE-PRESERVATION-001: Evolve 保留未分组后继的完整关系

Tests:
- `test:6ddf6fd56181d5d35eea039eafca3e4d0bf0a33031e07f36e0df233bb56307ed`

Tags:
- `decision-records`

Contract:
- 分组 replacement 只作用于指定 source；同一闭合事件中未分组的 established successor 保留自己的完整关系，candidate 可建立为分组 source。

Proves:
- summary 位于 relation 前仍绑定到 candidate 的完整拆分边；review 明确列出全部三个 selected source：candidate establish 与两个未分组 established unchanged，后者不接收默认 replacement。
