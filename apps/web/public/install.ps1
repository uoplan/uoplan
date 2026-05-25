# uoplan CLI installer for Windows
# Usage: irm https://uoplan.party/install.ps1 | iex
# Or to install to a custom directory:
#   $env:UOPLAN_INSTALL_DIR = "C:\Tools"; irm https://uoplan.party/install.ps1 | iex

param(
    [string]$InstallDir = $env:UOPLAN_INSTALL_DIR
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = "uoplan/uoplan"
$BinaryName = "uoplan.exe"

# ── Platform detection ───────────────────────────────────────────────────────
function Get-Target {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "x86_64-pc-windows-msvc" }
        "ARM64" { Write-Error "ARM64 Windows is not yet supported."; exit 1 }
        default { Write-Error "Unsupported architecture: $arch"; exit 1 }
    }
}

# ── Resolve install directory ────────────────────────────────────────────────
function Resolve-InstallDir {
    if ($InstallDir) { return $InstallDir }
    return Join-Path $env:USERPROFILE ".local\bin"
}

# ── Fetch latest release version ─────────────────────────────────────────────
function Get-LatestVersion {
    $url = "https://api.github.com/repos/$Repo/releases"
    $releases = Invoke-RestMethod -Uri $url -Headers @{ "User-Agent" = "uoplan-installer" }
    $tag = $releases | Where-Object { $_.tag_name -like "uoplan-v*" } | Select-Object -First 1 -ExpandProperty tag_name
    if (-not $tag) {
        Write-Error "Could not determine latest release version."
        exit 1
    }
    return $tag -replace "^uoplan-", ""
}

# ── PATH helper ──────────────────────────────────────────────────────────────
function Add-ToUserPath {
    param([string]$Dir)

    $currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    if ($currentPath -split ";" -contains $Dir) { return }

    $newPath = "$Dir;$currentPath"
    [System.Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    Write-Host "  Added $Dir to your user PATH."
    Write-Host "  Restart your terminal for it to take effect."
}

# ── Main ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "uoplan CLI installer" -ForegroundColor White
Write-Host ""

$Target  = Get-Target
$Version = Get-LatestVersion
$Dir     = Resolve-InstallDir

Write-Host "  Target:  $Target"
Write-Host "  Version: $Version"
Write-Host "  Install: $Dir"
Write-Host ""

$Archive    = "uoplan-${Target}.zip"
$TagEncoded = "uoplan-${Version}"
$Url        = "https://github.com/$Repo/releases/download/$TagEncoded/$Archive"

$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir | Out-Null

try {
    $ArchivePath = Join-Path $TmpDir $Archive

    Write-Host "Downloading $Archive..." -NoNewline
    Invoke-WebRequest -Uri $Url -OutFile $ArchivePath -UseBasicParsing
    Write-Host " done"

    Write-Host "Extracting..." -NoNewline
    Expand-Archive -Path $ArchivePath -DestinationPath $TmpDir -Force
    Write-Host " done"

    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir | Out-Null
    }

    $BinaryPath = Join-Path $TmpDir $BinaryName
    $DestPath   = Join-Path $Dir $BinaryName
    Move-Item -Path $BinaryPath -Destination $DestPath -Force

    Write-Host ""
    Write-Host "✓ uoplan $Version installed to $DestPath" -ForegroundColor Green
    Write-Host ""

    Add-ToUserPath $Dir

    Write-Host ""
    Write-Host "  Run ``uoplan --help`` to get started."
} finally {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
