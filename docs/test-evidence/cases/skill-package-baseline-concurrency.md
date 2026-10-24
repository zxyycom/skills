### Case SKILL-PACKAGE-BASELINE-CONCURRENCY-001: 版本基线独立比较有界并发且保留早停

Tests:
- `test:731f827e449b2b910fb3345f8d394a97db3ed83c9e95beea2e70d2fb81ea1809`

Tags:
- `repository-tooling`

Contract:
- 版本比较可以并发读取不同 skill 的不可变基线，但必须限制并发量；同一 skill 保留按需读取与首个普通变化后的早停，结果不因完成顺序改变。

Proves:
- 九个独立 skill 同时比较时最多四次读取并发，所有版本按原 skill 顺序返回；每个 skill 只读取首个变化文件与版本入口，不读取后续无关文件。
