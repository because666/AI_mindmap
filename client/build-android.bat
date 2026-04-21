@echo off
chcp 65001 >nul
echo ========================================
echo   DeepMindMap Android 构建脚本
echo ========================================
echo.

cd /d "%~dp0.."

echo [1/4] 检查Node.js环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)
node -v

echo.
echo [2/4] 安装npm依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)

echo.
echo [3/4] 同步Capacitor配置...
npx cap sync android
if %errorlevel% neq 0 (
    echo [错误] cap sync 失败
    pause
    exit /b 1
)

echo.
echo [4/4] 编译Android Debug APK...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo.
    echo [错误] 编译失败！
    echo.
    echo 可能的解决方案：
    echo   1. 确保已安装 JDK 21（当前需要Java 21）
    echo   2. 设置 JAVA_HOME 环境变量指向JDK 21
    echo   3. 或在Android Studio中打开项目进行编译
    pause
    exit /b 1
)

echo.
echo ========================================
echo   编译成功！
echo ========================================
echo APK位置: app\build\outputs\apk\debug\app-debug.apk
echo.

pause
