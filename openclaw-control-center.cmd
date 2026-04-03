@echo off
setlocal EnableDelayedExpansion

:: =============================================================================
:: OpenClaw Control Center Launcher
:: 适配官方 OpenClaw 配置 v2026.3.13
:: =============================================================================

set "VERSION=1.2.0"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_NAME=%~nx0"

:: 默认配置 - 使用官方 OpenClaw 路径
set "SCRIPT_PATH=%SCRIPT_DIR%control-center\start-control-center.ps1"
set "POWERSHELL_EXE=powershell.exe"
set "NO_BROWSER=0"
set "VERBOSE=0"

:: OpenClaw 官方配置路径
set "OPENCLAW_DIR=%USERPROFILE%\.openclaw"
set "SUPERVISOR_CMD=%OPENCLAW_DIR%\gateway-supervisor.cmd"
set "GATEWAY_START_CMD=%OPENCLAW_DIR%\gateway-start.cmd"

:: 端口配置（优先从环境变量读取，默认与 CLAUDE.md 一致）
:: 使用字符串比较而非 "if defined" 以正确处理空值
if not "%OPENCLAW_GATEWAY_PORT%"=="" (
    set "GATEWAY_PORT=%OPENCLAW_GATEWAY_PORT%"
) else (
    set "GATEWAY_PORT=18790"
)
if not "%OPENCLAW_CONTROL_PORT%"=="" (
    set "CONTROL_PORT=%OPENCLAW_CONTROL_PORT%"
) else (
    set "CONTROL_PORT=18809"
)

:: =============================================================================
:: 帮助信息
:: =============================================================================
if "%~1"=="--help" goto :ShowHelp
if "%~1"=="-h" goto :ShowHelp
if "%~1"=="/h" goto :ShowHelp
goto :ParseArgs

:ShowHelp
echo.
echo  OpenClaw Control Center Launcher v%VERSION%
echo.
echo  用法: %SCRIPT_NAME% [选项]
echo.
echo  选项:
echo    -h, --help       显示此帮助信息
echo    -v, --verbose    显示详细输出
echo    --no-browser     启动时不打开浏览器
echo    --status         仅检查服务状态
echo.
echo  环境变量:
echo    OPENCLAW_GATEWAY_PORT   网关服务端口号（默认: 18790）
echo    OPENCLAW_CONTROL_PORT   控制中心端口号（默认: 18809）
echo    OPENCLAW_NO_BROWSER     设置 1 以禁用浏览器自动打开
echo.
endlocal & exit /b 0

:: =============================================================================
:: 参数解析
:: =============================================================================
:ParseArgs
if "%~1"=="" goto :Main

:: 支持多 -v 参数（如 -vv, -vvv）
echo "%~1" | findstr /I "^-v*$" >nul && (
    set "VERBOSE=1"
    shift
    goto :ParseArgs
)

if /i "%~1"=="--verbose" (
    set "VERBOSE=1"
    shift
    goto :ParseArgs
)
if /i "%~1"=="--no-browser" (
    set "NO_BROWSER=1"
    shift
    goto :ParseArgs
)
if /i "%~1"=="--status" (
    shift
    call :CheckStatus
    :: 状态检查始终返回 0（因为这是查询模式，不是启动模式）
    endlocal & exit /b 0
)

echo [警告] 未知参数 "%~1"
shift
goto :ParseArgs

:: =============================================================================
:: 主逻辑
:: =============================================================================
:Main
call :LogInfo "启动 OpenClaw Control Center..."

:: 检查 PowerShell 是否可用
where !POWERSHELL_EXE! >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo [错误] 找不到 PowerShell。请确保 PowerShell 已安装并添加到 PATH。
    endlocal & exit /b 1
)

:: 检查 PowerShell 版本（需要 3.0+）
for /f "tokens=*" %%v in ('!POWERSHELL_EXE! -Command "[string]$PSVersionTable.PSVersion.Major" 2^>nul') do (
    if "%%v" neq "" (
        if %%v LSS 3 (
            echo [错误] 需要 PowerShell 3.0 或更高版本（当前: %%v）
            endlocal & exit /b 1
        )
        call :LogInfo "PowerShell 版本: %%v"
    ) else (
        call :LogInfo "无法获取 PowerShell 版本，继续执行..."
    )
)

:: 验证路径不包含危险字符（修复正则表达式问题：去掉 ^ 锚点）
echo !SCRIPT_PATH! | findstr /I /C:".." /C:"&" /C:"|" /C:";" >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo [错误] 脚本路径包含危险字符: !SCRIPT_PATH!
    endlocal & exit /b 1
)

:: 检查脚本文件是否存在
if not exist "!SCRIPT_PATH!" (
    echo [错误] 找不到脚本文件: !SCRIPT_PATH!
    echo [提示] 请确保 control-center\start-control-center.ps1 存在。
    endlocal & exit /b 1
)

:: 检查 supervisor 是否存在
if not exist "!SUPERVISOR_CMD!" (
    echo [警告] 找不到 supervisor 脚本: !SUPERVISOR_CMD!
)

call :LogInfo "使用脚本: !SCRIPT_PATH!"
call :LogInfo "网关端口: !GATEWAY_PORT!"
call :LogInfo "控制端口: !CONTROL_PORT!"

:: 设置环境变量
if !NO_BROWSER!==1 set "OPENCLAW_NO_BROWSER=1"

:: 从注册表加载用户环境变量（与官方 gateway-start.cmd 一致）
call :LoadUserEnv MINIMAX_API_KEY
call :LoadUserEnv MODELSCOPE_API_KEY
call :LoadUserEnv OPENAI_API_KEY
call :LoadUserEnv OPENCLAW_FEISHU_APP_SECRET
call :LoadUserEnv OPENCLAW_GATEWAY_TOKEN

:: 构建 PowerShell 参数（使用 RemoteSigned 而非 Bypass）
set "PS_ARGS=-NoProfile -ExecutionPolicy RemoteSigned -File "!SCRIPT_PATH!""

:: 执行 PowerShell 脚本
call :LogInfo "执行 PowerShell 脚本..."
!POWERSHELL_EXE! !PS_ARGS!
set "EXIT_CODE=!ERRORLEVEL!"

if !EXIT_CODE! neq 0 (
    echo [错误] PowerShell 脚本执行失败，退出码: !EXIT_CODE!
    if !VERBOSE!==0 (
        echo [提示] 运行: !SCRIPT_NAME! -v 查看详细信息
    )
)

:: 清理临时环境变量
call :CleanupEnv
endlocal & exit /b !EXIT_CODE!

:: =============================================================================
:: 日志函数
:: =============================================================================
:LogInfo
if !VERBOSE!==1 echo [INFO] %~1
exit /b 0

:: =============================================================================
:: 从注册表加载用户环境变量（与官方 gateway-start.cmd 一致）
:: =============================================================================
:LoadUserEnv
for /f "skip=2 tokens=1,2,*" %%A in ('reg query HKCU\Environment /v %~1 2^>nul') do (
    if /I "%%A"=="%~1" (
        set "%~1=%%C" 2>nul
        if !VERBOSE!==1 echo [INFO] 已加载环境变量: %~1
    )
)
exit /b 0

:: =============================================================================
:: 清理临时环境变量
:: =============================================================================
:CleanupEnv
set "OPENCLAW_NO_BROWSER="
exit /b 0

:: =============================================================================
:: 检查状态函数
:: =============================================================================
:CheckStatus
echo.
echo  检查 OpenClaw 服务状态...
echo   网关端口: !GATEWAY_PORT!
echo   控制端口: !CONTROL_PORT!
echo.

:: 检查网关服务
set "GATEWAY_STATUS=NG"
for /f %%e in ('!POWERSHELL_EXE! -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:!GATEWAY_PORT!/' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" 2^>nul') do set "GW_EXIT=%%e"
if defined GW_EXIT (
    if !GW_EXIT!==0 set "GATEWAY_STATUS=OK"
)
if "!GATEWAY_STATUS!"=="OK" (
    echo   [OK] 网关服务 (!GATEWAY_PORT!): 运行中
) else (
    echo   [NG] 网关服务 (!GATEWAY_PORT!): 未运行
)

:: 检查控制中心
set "CONTROL_STATUS=NG"
for /f %%e in ('!POWERSHELL_EXE! -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:!CONTROL_PORT!/' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" 2^>nul') do set "CC_EXIT=%%e"
if defined CC_EXIT (
    if !CC_EXIT!==0 set "CONTROL_STATUS=OK"
)
if "!CONTROL_STATUS!"=="OK" (
    echo   [OK] 控制中心 (!CONTROL_PORT!): 运行中
) else (
    echo   [NG] 控制中心 (!CONTROL_PORT!): 未运行
)

echo.
if "!GATEWAY_STATUS!!CONTROL_STATUS!"=="OKOK" (
    echo  所有服务运行正常
) else (
    echo  提示: 运行 !SCRIPT_NAME! 启动服务
)
echo.
:: 状态检查始终返回 0
exit /b 0
