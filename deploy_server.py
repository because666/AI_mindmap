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

try:
    ssh.connect('43.139.43.112', username='root', password='123456789Luo', timeout=15)
    print("SSH连接成功!")

    sftp = ssh.open_sftp()
    local_path = r"d:\study1\DeepMindMap\v2\admin\client\src\pages\Feedback\FeedbackPage.tsx"
    remote_path = f"{PROJECT_DIR}/admin/client/src/pages/Feedback/FeedbackPage.tsx"
    print(f"上传: FeedbackPage.tsx")
    sftp.put(local_path, remote_path)
    sftp.close()

    print("\n构建Admin前端...")
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/admin/client && npm run build", timeout=300)

    print("\n重启Admin服务...")
    run_ssh_command(ssh, "pm2 restart deepmindmap-admin")

    time.sleep(3)
    run_ssh_command(ssh, "pm2 list")

    print("\n部署完成!")

except Exception as e:
    print(f"错误: {e}")
finally:
    ssh.close()
    print("SSH连接已关闭")
