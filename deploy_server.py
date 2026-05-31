import paramiko
import time

def run_ssh_command(ssh, command, timeout=300):
    print(f"\n>>> 执行: {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out[-2000:] if len(out) > 2000 else out)
    if err:
        print(f"[STDERR] {err[-1000:] if len(err) > 1000 else err}")
    print(f"<<< 退出码: {exit_code}")
    return exit_code, out, err

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

PROJECT_DIR = "/www/wwwroot/AI_mindmap"
LOCAL_BASE = r"d:\study1\DeepMindMap\v2"

FILES_TO_UPLOAD = [
    ("server/src/routes/feedback.ts", f"{PROJECT_DIR}/server/src/routes/feedback.ts"),
    ("server/src/types/push.ts", f"{PROJECT_DIR}/server/src/types/push.ts"),
    ("server/src/services/pushService.ts", f"{PROJECT_DIR}/server/src/services/pushService.ts"),
    ("server/src/index.ts", f"{PROJECT_DIR}/server/src/index.ts"),
    ("admin/server/src/routes/feedbacks.ts", f"{PROJECT_DIR}/admin/server/src/routes/feedbacks.ts"),
    ("admin/server/src/routes/push.ts", f"{PROJECT_DIR}/admin/server/src/routes/push.ts"),
    ("admin/server/src/services/cacheNotify.ts", f"{PROJECT_DIR}/admin/server/src/services/cacheNotify.ts"),
    ("admin/server/src/types/index.ts", f"{PROJECT_DIR}/admin/server/src/types/index.ts"),
    ("admin/client/src/types/index.ts", f"{PROJECT_DIR}/admin/client/src/types/index.ts"),
    ("admin/client/src/pages/Feedback/FeedbackPage.tsx", f"{PROJECT_DIR}/admin/client/src/pages/Feedback/FeedbackPage.tsx"),
]

try:
    ssh.connect('43.139.43.112', username='root', password='123456789Luo', timeout=15)
    print("SSH连接成功!")

    sftp = ssh.open_sftp()
    for local_rel, remote_path in FILES_TO_UPLOAD:
        local_path = f"{LOCAL_BASE}\\{local_rel}".replace("/", "\\")
        print(f"上传: {local_rel}")
        sftp.put(local_path, remote_path)
    sftp.close()
    print(f"\n共上传 {len(FILES_TO_UPLOAD)} 个文件")

    print("\n构建主服务端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/server && npm run build", timeout=300)

    print("\n构建Admin服务端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/admin/server && npm run build", timeout=300)

    print("\n构建主前端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/client && npm run build", timeout=300)

    print("\n构建Admin前端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/admin/client && npm run build", timeout=300)

    print("\n重启服务...")
    run_ssh_command(ssh, "pm2 restart deepmindmap-server")
    run_ssh_command(ssh, "pm2 restart deepmindmap-admin")

    time.sleep(3)
    run_ssh_command(ssh, "pm2 list")

    print("\n验证环境配置...")
    run_ssh_command(ssh, f"grep -E '(MAIN_SERVER_URL|INTERNAL_API_TOKEN)' {PROJECT_DIR}/admin/server/.env 2>/dev/null || echo '未找到admin .env配置'")
    run_ssh_command(ssh, f"grep -E 'INTERNAL_API_TOKEN' {PROJECT_DIR}/server/.env 2>/dev/null || echo '未找到主服务端 INTERNAL_API_TOKEN 配置'")

    print("\n部署完成!")

except Exception as e:
    print(f"错误: {e}")
finally:
    ssh.close()
    print("SSH连接已关闭")
