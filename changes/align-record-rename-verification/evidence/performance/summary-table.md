# 正式 10k 逐值与分阶段

秒；normal 各 2 次，instrumented 各 1 次独立列出。不估计置信区间，不按差值扣除仪器开销。

| Version | 场景 | normal 1 | normal 2 | instrumented |
| --- | --- | ---: | ---: | ---: |
| before | DR rename | 10.380 | 8.071 | 8.073 |
| before | IR rename | 63.132 | 53.126 | 66.008 |
| before | DR discard | 9.520 | 8.616 | 10.906 |
| before | IR discard | 16.936 | 17.747 | 24.242 |
| after | DR rename | 7.836 | 7.722 | 7.738 |
| after | IR rename | 10.010 | 9.961 | 9.821 |
| after | DR discard | 8.836 | 8.666 | 8.996 |
| after | IR discard | 9.862 | 10.497 | 10.238 |

## 分阶段（仅 instrumented）

prepare 为 shared prepare；外层 domain prepare 见 JSON 中具名包容 interval，未计入本列。fresh+pre 与 post 合计用于跨版本义务范围对齐。残差含 launch/import/未插桩 domain 工作，不是纯 prepare。

| Version | 场景 | prepare | fresh+pre | write loop | publish | shared post | domain post | cleanup | 外部及未归因残差 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| before | DR rename | 0.874 | 0.814 | 0.008 | 0.192 | 0.781 | 0.011 | 0.000 | 5.395 |
| before | IR rename | 0.317 | 39.121 | 0.059 | 0.149 | 18.345 | 3.504 | 0.000 | 4.512 |
| before | DR discard | 1.005 | 0.789 | 0.004 | 0.180 | 1.251 | 0.028 | 0.000 | 7.651 |
| before | IR discard | 0.467 | 7.941 | 0.035 | 0.307 | 1.361 | 4.982 | 0.005 | 9.144 |
| after | DR rename | 0.896 | 0.857 | 0.008 | 0.181 | 0.748 | 0.007 | 0.000 | 5.042 |
| after | IR rename | 0.324 | 1.813 | 0.007 | 0.059 | 0.671 | 2.926 | 0.000 | 4.021 |
| after | DR discard | 0.786 | 0.782 | 0.004 | 0.182 | 0.895 | 0.007 | 0.000 | 6.341 |
| after | IR discard | 0.242 | 2.152 | 0.009 | 0.082 | 0.726 | 1.807 | 0.009 | 5.213 |

`resources.apply` 对本输入为空操作（零选中资源），精确值保留在 JSON；本表四舍五入至毫秒。每个包容 interval 的排他拆分、计划写集/unchanged/guards 计数、CPU/RSS 与最终 delta 见 `summary.json`。
