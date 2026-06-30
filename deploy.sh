#!/bin/bash
set -e

# ============================================================
# DeepMindMap V2 服务器端部署脚本（已废弃）
# ============================================================

echo ""
echo "此脚本已废弃。新的部署流程为：在本地执行 git commit/push、npm run build，然后通过 deploy_server.py 上传构建产物到服务器，服务器端仅替换产物并 PM2 重启。"
echo "禁止在服务器端执行 git pull / git reset / npm run build。"
echo "请改用：python deploy_server.py"
echo ""

exit 1
