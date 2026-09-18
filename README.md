# mesh-preview

Mobile-friendly WebGL previewer for SingaLab knitting mesh outputs.

在手机（Android Chrome）或桌面上打开项目文件夹 / 清单，轨道旋转查看网格，用三个双向滑块过滤 `cols_resample` / `row`（faces_ring） / `term`（当前最大 face_ring 内的针）。无需后端。

Open a project folder or manifest, orbit the mesh, and scrub the same three dual-handle range sliders as SingaLab: columns, face rings, then terms inside the max selected ring. Target: **Android Chrome** (desktop works too).

## 手机上打开 / Open on a phone

**首选 / Primary — GitHub Pages（任意网络，不必同一 Wi-Fi）：**

**https://singachen.github.io/mesh-preview/**

每次推送到 `main` 后，GitHub Actions（`.github/workflows/deploy-pages.yml`）会 `npm ci` → `npm run build`，并把 `dist/` 部署到 Pages。仓库 **Settings → Pages → Source** 需设为 **GitHub Actions**（首次由仓库管理员开启）。

在 **Android Chrome** 打开该地址后：

- 默认加载真实 **Test Cylinder**（`Single_Cylinder_Test`）。
- 三个双向滑块（半开区间 `[start, end)`，相邻手柄显示 1 项）：
  - **cols_resample**：过滤 `*_cols_resample_field.obj` 的列折线，标签如 `cols_resample: idx a-b / N`（圆柱 **42**）
  - **row**（副标题 faces_ring）：按 `first_rows` 的 face ring 过滤 KnittingStitches。半开区间 `[start, end)`，圆柱 **5** 环。切片宽度 **46, 136, 110, 106, 77**（合计 **475**）。颜色只来自 `rings[].types` → `term_face_colors`（Type0=331 灰，Type1=60 白）。缺 Type 会报错，不猜测。**不是** 475/5 均分。标签如 `row: idx 0-4 / 5`
  - **term**（副标题 `ring N`）：只切第二滑块右端那一环（active = `r1 - 1`）里的 term。更早的环整环保留。默认 `term: idx 0-76 / 77`（全选 `[0,5)` 时最大环是第 5 环 / 77 针）
- **文件夹 Folder** / **文件 Files** 仍从**手机本地**读取 OBJ 或清单（不上传服务器）。
- **示例 Sample** 重新加载内置圆柱。

生产构建会用 Service Worker 缓存同源资源，刷新可离线打开应用壳。界面若看起来是旧示例（如 cols_resample /84），请清除站点数据或注销 Service Worker 后再刷新。

## Quick start（本机开发 / Local, secondary）

```bash
npm install
npm run dev
```

Vite `base` 为 `/mesh-preview/`，浏览器打开终端里的地址（一般为 `http://localhost:5173/mesh-preview/`）。

同一局域网调试时，电脑运行 `npm run dev`（已加 `--host`），手机打开终端打印的 Network 地址（需带 `/mesh-preview/`）。公司网络可能隔离客户端。

生产构建：

```bash
npm run build
npm run preview
```

`npm run build` 输出静态文件到 `dist/`，资源路径带 `/mesh-preview/` 前缀。`npm run preview` 一般为 `http://localhost:4173/mesh-preview/`。

## 打开 SingaLab 输出 / Load a project

顶部 **打开 Open** 一个下拉（不再并排三个按钮）：

| 菜单项 | 作用 |
| --- | --- |
| **示例 Sample** | 重新加载内置 `public/sample/cylinder/`。 |
| **文件夹 Folder** | 桌面 Chrome：File System Access 选目录。Android Chrome：回退为 `webkitdirectory` 多文件选择。 |
| **文件 Files** | 多选 `.obj` / 清单 `.json` / `*_readable_map_step3_xfer.xls` / `readable_map.txt` / `*_cols_resample.xls`（Android 上最稳）。 |

没有清单时，会收集选中的 Wavefront OBJ，按文件名自然排序。文件名含 `overlay` / `field` / `stitch` / `KnittingStitches` 的 OBJ 会当作叠加层；同目录的 `*_readable_map_step3_xfer.xls`（优先于 `*_readable_map.txt`）与 `*_cols_resample.xls` 会自动绑到针迹 / 列场。

手势：

- 单指拖动：旋转 orbit
- 双指捏合：缩放；双指拖：平移 pan
- **适应 Fit**：框住当前网格
- **cols_resample / row / term**：桌面端同款半开区间双手柄；手机上轨道更瘦，手柄仍可点
- **底模 Base**（和 Warp / Stitch 同尺寸的多选按钮）：可同时勾选 线框 Wire / 面 Faces / 点 Points。默认 **隐藏 Off**（无线框/面/点）。勾选任一绘制层会取消 Off；再勾选 Off 会清掉其余三项并藏底模。点模式用更大的圆形 sprite，手机上也能看清。
- **列 Warp**：显隐 `cols_resample` 列折线。
- **针迹 Stitch**：显隐 KnittingStitches。
- **收起 Hide**：收起顶栏和底部控件；左右分栏仍在，3D 与生长图都保留。悬浮 **控件 UI** 再展开。收起/展开会重算 `camera.aspect`，避免画布被 CSS 拉扁。
- **生长图 Map**：宽屏左侧 3D、右侧优先 `iteration_0_cut_readable_map_step3_xfer.xls` 的 `step3` 表（122×52：`dir\\col` 表头，针位 **−14…36**，**89** 个织行段共 **507** 格，**121** 条显示行 / **32** 条移针，行序 `R` → `X+` → `L`…，减针会在跨度处拆成 `R` → `X` → `R`，**累计 hang `col_shift` 传到后续织行**（本行 X 后续织段 **以及** 第 N+1 行起点接到平移后的终点；右织 −hang），符号照写 `·` / `←1` / `vL` / `-R1` / …）。颜色跟 Excel `legend` / XF 填充（gold wrap、green increase、lime wrap+inc、rose decrease、orange wrap+dec、ice_blue transfer），**不用** Term.Type 上色。没有 xls 时才回退 `*_readable_map.txt`。滚轮 / 捏合 / 按钮缩放，拖动平移，加载时适应。窄屏用 **3D / 图 Map** 切换，不硬挤并排。
- 点按一根针迹：保留命中，HUD 芯片显示 **列 col**（针位）、**ring / term / face**、**Term.Type**（Type0=平针 PLAIN；其余用调色板短名）。右侧 Excel 图的针迹绑定来自桌面 `stitch_map_bind.json`（`generate_step3_xfer` + `_display_lines`）：只点亮该 face 列出的 **R/L 织行格子**（`display_row,needle`）。**X / X+ 是移针 / transfer，不对应任何 stitchmesh 面**，点针迹不会高亮它们。加针 / 减针跨度（一个 term 多格；减针 `n→1` 占 n 格，玫瑰色 `-Rn` + `·`）会一次点亮全部格子。没有 bind 文件时 Excel 侧不高亮（不再按整列回退）。必要时轻轻平移到可见。不隔离、不改滑块。空白处再点清空芯片和地图高亮。选中面有一圈浅色描边，其它面仍在。窄屏在 3D 页点选也会记下高亮，切到 **图 Map** 能看到。
- 点右侧 Excel 织行格（**R / L**）会反向选中左侧对应 KnittingStitches 面，芯片 / 描边 / 地图高亮与点 3D 针迹相同。加针 / 减针跨度（如 `+R2` / `-R1`）点任一格都会选整个 term。点 **X / X+** 移针行不选针；点空灰格清空选中。平移 / 捏合仍可用：指针移动超过约 8px 不当作点击。

## 三个滑块怎么对应 SingaLab

与 `dependence/func_knitting.py` + `ui/ui_functions/ui_knitting.py` 一致：

| 滑块 | 范围 | 效果 |
| --- | --- | --- |
| **cols_resample** | `0..N_cols` | `apply_cols_resample_range`：只留 `[start, end)` 列。`N` 是桌面 `len(cols_resample)`（圆柱新鲜导出 **42**）。与 xls `scale_matrix` 行数、field.obj 顺序链条数一致。 |
| **row**（faces_ring） | `0..N_rings` | 半开区间 `[r0, r1)`。`first_rows.xls` 是转置种子矩阵（`col\\row` + `row_0..row_5`，**N_seed=6**）。桌面 `path_generate` 跳过 index 0，所以滑条 **N = 5**。`readable_map` 的 65 个 `rowNNN` 是展开后的机头行，不是 N。 |
| **term** | `0..N_terms` of **max ring** | 第二滑块右端环 `active = r1 - 1` 内的 term 半开区间 `[t0, t1)`。`r1 <= r0` 时第三滑块禁用（`term: -`）。第二滑块一改 active ring，第三滑块重置为该环全长 `[0, N)`。 |

可见性（与桌面一致）：

- `ring < r0`：隐藏
- `r0 <= ring < r1-1`：该环全部 term
- `ring == r1-1`：只留 `[t0, t1)`
- `ring >= r1`：隐藏

`_normalize_half_open_slider` 保证 `end >= start + 1`。标签：`cols_resample: idx a-b / N`；`row: idx a-b / 5`；`term: idx a-b / N`（副标题 `ring N`）。没有针迹的项目才显示旧的 `display_models` 滑块。

`iteration_0_cut_KnittingStitches.obj` 每个面是一针，文件顺序即 `faces_allin` 展平。`faces_ring_layout.json` 来自 `path_list` / `knittingMapGenerate_Auto`：`n_terms` **46, 136, 110, 106, 77**，每个面一个 `Term.Type`。上色只查 `term_face_colors`，不用 OBJ 顶点色猜测，也不用 default 粉/白填空。不要均分 475/5，也不要把 65 个 `rowNNN` 或 6 个种子列当成 N。

针迹面按桌面 `build_and_show_knitting_stitches` 的 Term.Type 上色（灰 / 白 / 黑 / 红 / 绿 / 黄 / 蓝 / 粉），边线黑色（`edge_color: [0,0,0]`）。没有 sidecar 时才按 N 环均分。

旧的 `display_models` 滑块在 KnittingStitches 针迹视图里让位给 **term**。没有针迹、只有 cut / cols 时仍可用它显隐模型。

桌面 `save_cols_resample_obj` 按列顺序写 field.obj：每列先追加全部顶点，再只在该列相邻顶点之间写 `l` 边（无 object 分组）。`save_cols_resample_excel` 的 `scale_matrix` 同样一行一列。预览按这两种真实导出几何解析：优先把 `points_detail` 按连续 col id `0..N-1` 分组，否则沿 field.obj 顶点序把最长 `(i,i+1)` 边跑当成一列（孤立顶点是长度为 1 的列）。圆柱新鲜导出是 **42** 列 / 459 点，xls 行数与 field 链 1:1。不要用角度启发式或 sidecar 去合并 SHORT_*。

## 清单 schema / Manifest schema

可选。放在项目根目录，文件名建议 `manifest.json`：

```json
{
  "name": "Single_Cylinder_Test",
  "outputs": [
    {
      "label": "iter 0 · cylinder stitches",
      "mesh": "cylinder/cut_iteration_0.obj",
      "overlay": "cylinder/iteration_0_cut_KnittingStitches.obj",
      "stitches": "cylinder/iteration_0_cut_KnittingStitches.obj",
      "readableMap": "cylinder/iteration_0_cut_readable_map_step3_xfer.xls",
      "readableMapTxt": "cylinder/iteration_0_cut_readable_map.txt",
      "colsResample": "cylinder/iteration_0_cut_cols_resample_field.obj",
      "colsResampleXls": "cylinder/iteration_0_cut_cols_resample.xls",
      "firstRows": "cylinder/iteration_0_cut_first_rows.xls",
      "facesRingLayout": "cylinder/faces_ring_layout.json",
      "stitchMapBind": "cylinder/stitch_map_bind.json"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 否 | 项目名 |
| `outputs` | 是 | 滑条上的条目（多迭代时用；打开后默认最后一项） |
| `outputs[].label` | 否 | 短标签，中英均可 |
| `outputs[].mesh` | 是 | 相对清单目录的 Wavefront OBJ（也接受 `obj` / `path`） |
| `outputs[].overlay` | 否 | 叠加 OBJ（针迹 / field 等，也接受 `field`） |
| `outputs[].stitches` | 否 | 针迹 OBJ（带 `v x y z r g b` 的 n 边形）。缺省时用 `*KnittingStitches*.obj` |
| `outputs[].readableMap` | 否 | 优先 `*_readable_map_step3_xfer.xls`（`step3` + `legend`）。缺省时先找 step3 xls，再回退 `*readable_map*.txt` |
| `outputs[].readableMapTxt` | 否 | 旧 `readable_map.txt`，只用于针迹列/织行绑定。缺省时用同目录 `*readable_map*.txt` |
| `outputs[].colsResample` | 否 | `*_cols_resample_field.obj`（也接受 `field`）。顺序 `(i,i+1)` 链即桌面列 |
| `outputs[].colsResampleXls` | 否 | `*_cols_resample.xls`。`scale_matrix` 一行一列；`points_detail` 按 col `0..N-1` 分组 |
| `outputs[].firstRows` | 否 | `*_first_rows.xls`。种子矩阵；滑条 N = `row_*` 列数 − 1。缺省时用同目录 `*first_rows*.xls` |
| `outputs[].facesRingLayout` | 否 | `faces_ring_layout.json`。`rings[].n_terms` + `types[]` + `term_face_colors` + `edge_color`。缺省时用同目录 `*faces_ring_layout*.json` |
| `outputs[].stitchMapBind` | 否 | 桌面 `stitch_map_bind.json`。`faces[]` 的 `path_index` / `term_index` + `display_row,col`。只绑 R/L；X/X+ 是移针。缺省时用同目录 `*stitch_map_bind*.json` |

也支持无清单直接打开 cut OBJ + KnittingStitches + readable_map。

内置示例：`public/sample/cylinder/`。

## 范围 / Scope

包含：静态站、GitHub Pages、本地文件、OBJ、cols_resample / faces_ring / term-in-max-ring 双手柄、Type 上色 + 黑边、底模模式（线框/面/点）、列 Warp、针迹、点按针迹读数列/面/Type（不隔离）、控件收起、画布宽高比同步、左右分栏生长图（pan/zoom）、可选清单、触摸轨道、适应视野、离线应用壳。

不做：原生 Android、账号、云同步、完整 `readable_map` 编辑器。

## 技术

Vite + Three.js（`OrbitControls` + `OBJLoader` + 自定义针迹面解析）。无后端。
