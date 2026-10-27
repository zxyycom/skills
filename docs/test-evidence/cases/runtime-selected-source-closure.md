### Case RUNTIME-SELECTED-SOURCE-CLOSURE-001: 源码事实只读真实传递闭包并拒绝越域复用

Tests:
- `test:fd446e0ad6a51d74b288893d196f17579c6f2746b03af0fdd2320e7e4d025dee`

Tags:
- `repository-tooling`

Contract:
- 窄生成沿 entry 的真实递归模块引用采集，保留 shared 闭包并容忍循环，不全扫无关源码；窄事实不能被其他 entry 冒用。

Proves:
- 真实 ast-grep 采集只得到 alpha 与 shared 两文件，.js 引用归一为 .ts 且循环终止；全量采集会拒绝无关 escaped import，而窄采集成功。
- 把窄事实用于未覆盖 entry 时明确拒绝；选中 shared 的 escaped import 或缺失传递文件仍失败，不把漏读当成功。
