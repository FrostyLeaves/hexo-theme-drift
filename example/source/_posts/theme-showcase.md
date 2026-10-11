---
title: 主题功能一览
date: 2026-01-01 10:00:00
license: CC BY 4.0
palette: gold   # 可选：覆盖这篇文章的调色板（blue / green / gold / red）
description: 这篇示例文章演示 Drift 主题的全部写法：标题层级、代码块、表格、引用、随调色板变色的 SVG 图示和 ditaa 文本图。
categories:
  - 示例
tags:
  - 主题
  - 图示
---

这篇文章只用来展示版式。把它和同名资源目录一起复制到站点的 `source/_posts/` 下即可预览；正文前两段会出现在首页卡牌的摘要里，除非 front-matter 写了 `description`。

一次 `DrawIndexed` 调用通常很快就返回了，但屏幕上的三角形要晚一些才能出现。行内代码、**粗体**和链接的样式都在这一段里：参见 [Hexo 文档](https://hexo.io/docs/)。

<!-- more -->

## 随调色板变色的 SVG 图示

下面这张图用 `{% raw %}{% theme_svg %}{% endraw %}` 嵌入。图形元素通过令牌取色；点右上角的调色板按钮切换，可以看到图里的强调色平滑过渡。文件结构与配色规则见 [SVG 编写规范](https://github.com/FrostyLeaves/hexo-theme-drift/blob/main/docs/guide.zh-CN.md#svg-contract)。

{% theme_svg 01-pipeline.svg 一次绘制从 CPU 录制到 GPU 执行的三段流程 %}

### ditaa 文本图

同一机制也覆盖 ```` ```ditaa ```` 围栏：首次构建时经 Kroki 渲染并缓存到 `source/_diagrams/`，之后离线。

```ditaa 内存块与请求
+------+----------------------+----+----------------------------------+------+
| Used |       Free           |Used|            Free                  | Used |
| 100B |       200B           |50B |            500B                  | 80B  |
| cE99 |       c6B8           |cE99|            c6B8                  | cE99 |
+------+----------------------+----+----------------------------------+------+
                 ^
                 |
           +-------------+
           | Request 150B|
           |    c9BE     |
           | First Fit   |
           +-------------+
```

## 代码块

带语言标注的围栏会显示语言标签，悬停出现复制按钮；行号由 Hexo 的 `highlight.line_number` 控制。

```cpp
struct Block {
  size_t size;
  Block* next;
};

Block* first_fit(Block* head, size_t size) {
  for (Block* b = head; b; b = b->next) {
    if (b->size >= size) return b;   // 第一个够大的块
  }
  return nullptr;
}
```

没有语言标注的围栏按纯文本显示，不会被猜成别的语言（站点里建议关闭 `highlight.auto_detect`）。

## 表格

| 名称 | 职责 | 备注 |
|---|---|---|
| Command buffer | 录制一组 GPU 命令 | 由应用填充 |
| Queue | 接收提交并排队 | 逻辑概念，映射到硬件由驱动决定 |
| Fence | 通知 CPU 一批工作已完成 | 用于资源复用 |

宽表格在窄屏上会横向滚动，不会撑破页面。

## 引用与列表

> 图像就绪后，由呈现系统安排显示；渲染完成与上屏是不同事件。

1. 录制命令
2. 提交到队列
3. 等待完成信号

- 无序列表项一
- 无序列表项二

### 更深一级的标题

h3 和 h4 都会进入右侧目录；目录默认收到三级。

#### 第四级标题

这一级不进目录。
