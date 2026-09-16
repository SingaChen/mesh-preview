# mesh-preview

Mobile-friendly WebGL previewer for SingaLab knitting mesh outputs.

在手机（Android Chrome）或桌面上打开项目文件夹 / 清单，轨道旋转查看网格，用滑条看针迹按行生长、按列高亮轨迹。无需后端。

Open a project folder or manifest, orbit the mesh, scrub knitting-row growth, and inspect per-column stitch trajectories. Target: **Android Chrome** (desktop works too).

## 手机上打开 / Open on a phone

**首选 / Primary — GitHub Pages（任意网络，不必同一 Wi-Fi）：**

**https://singachen.github.io/mesh-preview/**

每次推送到 `main` 后，GitHub Actions（`.github/workflows/deploy-pages.yml`）会 `npm ci` → `npm run build`，并把 `dist/` 部署到 Pages。仓库 **Settings → Pages → Source** 需设为 **GitHub Actions**（首次由仓库管理员开启）。

在 **Android Chrome** 打开该地址后：

- 默认加载真实 **Test Cylinder** 针迹（`Single_Cylinder_Test`，2026-09-16）。
- **生长 Row** 滑条按 `readable_map` 的行号（0…68）显示「织到这一行」：只保留 `row ≤ R` 的针迹。
- **列轨迹 Col** 滑条（或点按一根针迹）按针号着色 / 单列高亮。
- **文件夹 Folder** / **文件 Files** 仍从**手机本地**读取 OBJ 或清单（不上传服务器）。
- **示例 Sample** 重新加载内置圆柱。

生产构建会用 Service Worker 缓存同源资源，刷新可离线打开应用壳。

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

顶部按钮：

| 按钮 | 作用 |
| --- | --- |
| **文件夹 Folder** | 桌面 Chrome：File System Access 选目录。Android Chrome：回退为 `webkitdirectory` 多文件选择。 |
| **文件 Files** | 多选 `.obj` / 清单 `.json` / `readable_map.txt`（Android 上最稳）。 |
| **示例 Sample** | 重新加载内置 `public/sample/cylinder/`。 |

没有清单时，会收集选中的 Wavefront OBJ，按文件名自然排序。文件名含 `overlay` / `field` / `stitch` / `KnittingStitches` 的 OBJ 会当作叠加层；同目录的 `*_readable_map.txt` 会自动绑到针迹。

手势：

- 单指拖动：旋转 orbit
- 双指捏合：缩放；双指拖：平移 pan
- **适应 Fit**：框住当前网格
- **生长 Row**：织到第 R 行（来自 `readable_map` 行号 + OBJ 面生成序，不是按高度假分）
- **列轨迹 Col**：全部列按色相区分；滑到某一列（或点按针迹）只高亮该列
- **线框 Wire** / **平面 Flat** / **针迹 Stitch**

## 针迹行 / 列怎么来的

`iteration_0_cut_KnittingStitches.obj` 每个面是一针，文件顺序即生成序（前 35 面是 row000 的一圈 35 针）。`iteration_0_cut_readable_map.txt` 按同样顺序给出 `rowNNN` + needle `col`。450 个面能对上前 450 个 token；图末尾 65–68 行还有 token 但没有针迹几何，滑条到那些行不会再长出面。

`first_rows.xls` / `cols_resample.xls` 描述的是 84 条 resample 场线，不是这 450 针，运行时不拿它们编造行号。

顶点色：灰 0.55 = 普通针，红 = 特殊/高亮；预览里列色相是主着色（轨迹），不是顶点色。

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
      "readableMap": "cylinder/iteration_0_cut_readable_map.txt"
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
| `outputs[].readableMap` | 否 | `readable_map.txt`。缺省时用同目录 `*readable_map*.txt` |

也支持无清单直接打开 cut OBJ + KnittingStitches + readable_map。

内置示例：`public/sample/cylinder/`。

## 范围 / Scope

包含：静态站、GitHub Pages、本地文件、OBJ、针迹列轨迹、按行生长、可选清单、触摸轨道、线框/平面、适应视野、离线应用壳。

不做：原生 Android、账号、云同步、完整 `readable_map` 编辑器。

## 技术

Vite + Three.js（`OrbitControls` + `OBJLoader` + 自定义针迹面解析）。无后端。
