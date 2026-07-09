param(
  [string]$Model = "qwen2.5-coder:7b",
  [string]$HostValue = "0.0.0.0:11434"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-Ollama {
  $command = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "$env:ProgramFiles\Ollama\ollama.exe",
    "$env:ProgramFiles(x86)\Ollama\ollama.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "ollama.exe was not found. Install Ollama for Windows first."
}

Write-Step "Configuring Ollama to listen outside Windows localhost"
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", $HostValue, "User")
$env:OLLAMA_HOST = $HostValue
Write-Host "OLLAMA_HOST set to $HostValue for the current Windows user."

if (Test-Admin) {
  Write-Step "Ensuring Windows Firewall allows TCP 11434"
  $existingRule = Get-NetFirewallRule -DisplayName "SDLC Hub Ollama 11434" -ErrorAction SilentlyContinue
  if (-not $existingRule) {
    New-NetFirewallRule `
      -DisplayName "SDLC Hub Ollama 11434" `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort 11434 | Out-Null
    Write-Host "Firewall rule created."
  } else {
    Write-Host "Firewall rule already exists."
  }
} else {
  Write-Host "Not running as Administrator. Firewall rule was skipped." -ForegroundColor Yellow
  Write-Host "If WSL still cannot connect, run this script once as Administrator."
}

$ollamaPath = Find-Ollama

Write-Step "Restarting Ollama"
Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
Start-Sleep -Seconds 4

Write-Step "Checking local Windows Ollama endpoint"
$tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 10
$modelNames = @($tags.models | ForEach-Object { $_.name })
Write-Host "Installed models: $($modelNames -join ', ')"

if ($modelNames -notcontains $Model) {
  Write-Step "Pulling missing model $Model"
  & $ollamaPath pull $Model
} else {
  Write-Host "Model $Model is already installed."
}

Write-Step "Done"
Write-Host "Now test from WSL:"
Write-Host "  curl http://`$(awk '/nameserver/{print `$2; exit}' /etc/resolv.conf):11434/api/tags"
Write-Host ""
Write-Host "Then open SDLC Hub Settings -> Project AI provider -> Test provider."
