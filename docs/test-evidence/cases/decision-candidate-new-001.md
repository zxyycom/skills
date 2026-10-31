### Case DECISION-CANDIDATE-NEW-001: New 创建规范未完成 scaffold 且不建立记录

Tests:
- `test:66f450ce098af7a73eb9ccc381575fc395233e838b87a258f93ddcc02022626f`

Tags:
- `decision-records`

Contract:
- new 核对自身输入、可见身份、集合安全与不覆盖条件，创建合法但未完成的候选，不默认运行发布级辅助预检；无法可信分类为候选或正式记录的来源必须 fail-close。

Proves:
- 创建输出表达 scaffold/body readiness，候选未进入发布索引；重复身份、锁冲突和非法路径拒绝且不覆盖；加入无法分类的非 Decision Markdown 后，新草稿创建退出 1、报告分类失败且目标文件不存在。
