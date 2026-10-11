# 飞行足迹 · Flight Atlas

在可旋转、可缩放的卫星地球仪上，串联已完成的模拟飞行航程。

**打开网页：https://nomooncake.github.io/flight-atlas/**

当前记录：杭州萧山 → 上海浦东 → 香港 → 胡志明市 → 曼谷 → 吉隆坡 → 新加坡，共 6 段航程、7 座机场。首段为早期起降练习，具体日期未记录。

## 使用

- 拖动旋转地球，滚轮或加减按钮缩放；N ↑ 恢复北向上。
- 点击左侧航程，聚焦对应航段。
- 勾选「显示航点」，查看沿途航点；标注会随缩放和屏幕间距调整。
- 「航程总览」显示所有已完成航程，「地球总览」返回完整地球。

## GitHub Pages

本仓库是无需构建的静态网站。入口为根目录 `index.html`。

在 **Settings → Pages** 中，发布来源为 **Deploy from a branch**，分支为 **main**，目录为 **/(root)**。`.nojekyll` 用于直接发布静态文件。提交到 `main` 后，GitHub Pages 会自动更新。

## 文件与维护

- `index.html`：页面入口。
- `globe.js`：Cesium 地球仪、航段交互与标注避让。
- `style.css`、`map.css`、`globe.css`：页面、独立滚动布局和地球仪样式。
- `routes.json`：网页读取的航程、机场、航点数据。
- `routes.geojson`：同一航路的地理数据导出。
- `assets/cesium/`：本地打包的 CesiumJS 1.146.0、Workers、Widgets、基础地球纹理和许可证。
- `imagery-config.json`：公开客户端专用的受限只读地图令牌及影像资产 ID。

追加航程时，保留历史航程，在 `routes.json` 中追加航段，并同步更新 `routes.geojson`。航段列表、里程、机场数量和当前目的地由数据生成。

本地预览见下方「地图账号配置」。卫星底图需要联网加载。

## 数据与说明

航路根据提供的模拟飞行计划和 AIRAC 2610 航点重建，不是实飞 GPS 记录。虚线表示引导或非定点航段的示意连接；程序转弯以点间连线简化。仅用于模拟飞行记录。

地图使用 CesiumJS 和 Cesium ion 提供的 Google Maps 2D Satellite with Labels（资产 3830183）。卫星图按当前视野及缩放逐级加载；使用平滑地球表面，不加载 3D 建筑或高程服务。数据署名由 Cesium 自动维护，显示于网页底部。第三方地图、导航数据的权利属于各自提供方，本仓库不另行授予这些数据的使用权。

CesiumJS 使用 Apache-2.0 许可证，见 `assets/cesium/LICENSE.md`。卫星服务不可用时回退到本地基础地球并明确提示；基础图只用于概览，不能替代高分辨率卫星影像。

## 地图账号配置

`imagery-config.json` 中的令牌是设计用于公开浏览器的 `assets:read` 令牌，仅允许资产 3830183，允许来源为 `https://nomooncake.github.io` 和 `http://127.0.0.1:8766`。不能使用默认令牌或包含账户管理、写入权限的私密令牌。更换域名后，应先更新 Cesium ion 中的 Allowed URLs。

卫星加载使用站点所有者的 Cesium ion 额度；访问者无需登录。额度与方案在 Cesium ion 的 Usage 页面查看。限制来源的令牌不能阻止他人访问公开网站并消耗正常地图额度。

本机卫星预览需使用：`python -m http.server 8766 --bind 127.0.0.1`，然后打开 `http://127.0.0.1:8766/`。其他本地端口未列入令牌允许来源。
