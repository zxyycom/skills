---
title: 分离 task-graph raw result 与输出函数
status: active
alignment: aligned
createdAt: 2026-08-08T02:15:18Z
purpose: 让程序化调用和多种 CLI 表达共享一份完整结果，而不让显示布局成为领域事实。
background: 单一 JSON 输出容易把完整语义与具体表达绑定；新增文本视图若反向读取索引或污染 projection，会形成第二套推导。
decision: Service 与 dispatch 先返回结构化 raw result，CLI 再按已识别路由选择纯 serializer 或 renderer；显示派生不进入公开 projection。
relations: []
---

## 目的

- 让命令行与程序化调用共享同一份完整 task-graph 结果语义。
- 允许不同命令选择适合用途的文本表达，而不复制领域推导或建立第二事实源。
- 保持显示布局、格式选择和领域 API 之间的责任边界清楚。

## 背景

- JSON serializer 能完整保留协议结果，但“结果必须存在”与“结果只能用 JSON 表达”是两个不同判断。
- 如果 renderer 重新读取索引、解析 JSON 文本或自行推导有效状态与关系，serializer 和 renderer 会形成可以分叉的语义路径。
- 如果为显示需要把 track、layer、缩进或折叠 token 写入公开 projection，短期布局选择会反向扩大领域契约。
- 程序化调用需要直接获得结构化对象；CLI 输出函数只应决定同一对象如何写入 stdout。

## 决策

- 采用: Service 与 dispatch 始终先产生结构化 raw result object；程序化调用直接消费该对象，CLI 在操作和全局模式已经识别后才选择输出函数。
- 采用: 通用 JSON serializer 忠实序列化 raw result；command-specific renderer 是只消费 raw result 与显式 render context 的纯显示边界。
- 采用: Renderer 不读取权威索引、不解析 serializer 生成的文本，也不重新推导有效状态、关系或错误语义；渲染失败不能静默改走另一种输出以掩盖错误。
- 采用: Layout、分组、折叠和预格式化字段只存在于 renderer 的临时结构，不进入 raw projection、持久数据或公开领域 API。
- 不采用: 为每种表达建立独立查询实现、把 JSON 文本作为 renderer 输入，以及为当前单一特例建立公开 renderer registry 或扩展 API。
