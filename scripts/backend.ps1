param(
    [ValidateSet("Start", "InstallStartup", "RemoveStartup")]
    [string]$Action = "Start"
)

$ErrorActionPreference = "Stop"
$taskName = "NgheTiengHanBackend"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"
$pythonPath = Join-Path $backendPath ".venv\Scripts\python.exe"
$stdoutLog = Join-Path $backendPath "backend.log"
$stderrLog = Join-Path $backendPath "backend-error.log"

function Test-BackendHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
        return $response.ok -eq $true
    }
    catch {
        return $false
    }
}

function Start-Backend {
    if (Test-BackendHealth) {
        Write-Host "Backend da dang chay tai http://localhost:8000"
        return
    }

    if (-not (Test-Path $pythonPath -PathType Leaf)) {
        throw "Khong tim thay $pythonPath. Hay tao virtualenv va cai dependencies theo README.md."
    }

    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
        throw "Cong 8000 dang duoc mot ung dung khac su dung."
    }

    $process = Start-Process `
        -FilePath $pythonPath `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000") `
        -WorkingDirectory $backendPath `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (Test-BackendHealth) {
            Write-Host "Backend da san sang tai http://localhost:8000"
            return
        }

        if ($process.HasExited) {
            throw "Backend dung dot ngot. Kiem tra log: $stderrLog"
        }

        Start-Sleep -Milliseconds 500
    }

    throw "Backend chua san sang sau 15 giay. Kiem tra log: $stderrLog"
}

switch ($Action) {
    "Start" {
        Start-Backend
    }
    "InstallStartup" {
        if (-not (Test-Path $pythonPath -PathType Leaf)) {
            throw "Khong tim thay $pythonPath. Hay tao virtualenv va cai dependencies theo README.md."
        }

        $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $scriptPath = Join-Path $PSScriptRoot "backend.ps1"
        $powerShellPath = Join-Path $PSHOME "powershell.exe"
        $scheduledAction = New-ScheduledTaskAction `
            -Execute $powerShellPath `
            -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`" -Action Start" `
            -WorkingDirectory $repoRoot
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
        $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $scheduledAction `
            -Trigger $trigger `
            -Principal $principal `
            -Description "Khoi dong backend Nghe Tieng Han khi dang nhap Windows." `
            -Force | Out-Null

        Write-Host "Da bat tu dong khoi dong backend moi lan dang nhap Windows."
        Start-Backend
    }
    "RemoveStartup" {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($task) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Da tat tu dong khoi dong backend."
        }
        else {
            Write-Host "Chua cai tu dong khoi dong backend."
        }
    }
}
