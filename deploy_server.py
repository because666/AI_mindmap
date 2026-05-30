import paramiko
import time
import os

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
LOCAL_DIR = r"d:\study1\DeepMindMap\v2"

try:
    ssh.connect('43.139.43.112', username='root', password='123456789Luo', timeout=15)
    print("SSH连接成功!")

    sftp = ssh.open_sftp()

    files_to_upload = [
        "client/src/components/Layout/MainLayout.tsx",
        "client/src/components/Feedback/FeedbackModal.tsx",
        "server/src/services/emailService.ts",
        "server/src/routes/feedback.ts",
        "server/src/index.ts",
        "server/.env.example",
        "server/package.json",
        "server/package-lock.json",
    ]

    for rel_path in files_to_upload:
        local_path = os.path.join(LOCAL_DIR, rel_path)
        remote_path = f"{PROJECT_DIR}/{rel_path}"
        remote_dir = os.path.dirname(remote_path)
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            print(f"  创建目录: {remote_dir}")
            run_ssh_command(ssh, f"mkdir -p {remote_dir}")
        print(f"上传: {rel_path}")
        sftp.put(local_path, remote_path)

    sftp.close()
    print("\n所有文件上传完成!")

    print("\n验证上传的文件...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && grep -n 'feedbackRouter' server/src/index.ts | head -3")
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && grep -n 'MessageCircle' client/src/components/Layout/MainLayout.tsx | head -3")

    print("\n安装服务端依赖...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/server && npm install", timeout=120)

    print("\n配置SMTP环境变量...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/server && grep -q 'SMTP_HOST' .env || echo '\n# SMTP Email Configuration\nSMTP_HOST=smtp.qq.com\nSMTP_PORT=465\nSMTP_USER=3694224048@qq.com\nSMTP_PASS=ggnghygmwlrldbcf\nFEEDBACK_EMAIL=3694224048@qq.com' >> .env")

    print("\n构建前端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/client && npm run build", timeout=300)

    print("\n构建后端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/server && npm run build", timeout=300)

    print("\n重启服务...")
    run_ssh_command(ssh, "pm2 restart deepmindmap-server")

    time.sleep(3)
    run_ssh_command(ssh, "pm2 list")

    print("\n验证反馈API...")
    run_ssh_command(ssh, "curl -s -X POST http://localhost:3001/api/feedback -H 'Content-Type: application/json' -d '{\"title\":\"部署测试\",\"description\":\"验证反馈功能\",\"type\":\"其他\"}'")

    print("\n部署完成!")

except Exception as e:
    print(f"错误: {e}")
finally:
    ssh.close()
    print("SSH连接已关闭")
