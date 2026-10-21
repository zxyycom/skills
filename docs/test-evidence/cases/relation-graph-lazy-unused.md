### Case RELATION-GRAPH-LAZY-UNUSED-001: 关系图在首次使用时才取得构建输入

Tests:
- `test:83de7713cbb129ee66336a236b7f99dd69351b01ae6026037fad3a3582936d2d`

Tags:
- `graph`

Contract:
- 惰性访问器绑定单次不可变关系快照，只在首次图需求时调用构建函数。

Proves:
- 创建访问器后构建函数调用数为零。
