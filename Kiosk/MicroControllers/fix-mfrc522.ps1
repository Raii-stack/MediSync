# MFRC522 Library Fix Script
# Fixes compilation error with ESP32 core 2.0.x

$libraryPath = "$env:USERPROFILE\OneDrive\Documents\Arduino\libraries\MFRC522\src\MFRC522Extended.cpp"

# Check if library exists
if (-not (Test-Path $libraryPath)) {
    # Try alternative Arduino path
    $libraryPath = "$env:USERPROFILE\Documents\Arduino\libraries\MFRC522\src\MFRC522Extended.cpp"
    
    if (-not (Test-Path $libraryPath)) {
        Write-Host "[ERROR] MFRC522Extended.cpp not found!" -ForegroundColor Red
        Write-Host "Expected at: $libraryPath" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[INFO] Found library at: $libraryPath" -ForegroundColor Cyan

# Backup original file
$backup = "$libraryPath.backup"
if (-not (Test-Path $backup)) {
    Copy-Item $libraryPath $backup
    Write-Host "[OK] Backup created: $backup" -ForegroundColor Green
} else {
    Write-Host "[INFO] Backup already exists" -ForegroundColor Yellow
}

# Read file content
$content = Get-Content $libraryPath -Raw

# Fix line 824 and 847
$fixed = $content -replace 'if \(backData && \(backLen > 0\)\)', 'if (backData && backLen)'

# Write back
Set-Content -Path $libraryPath -Value $fixed -NoNewline

Write-Host "[OK] MFRC522Extended.cpp patched successfully!" -ForegroundColor Green
Write-Host "[INFO] Now try compiling your sketch again" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you need to restore original:" -ForegroundColor Gray
Write-Host "  Copy-Item '$backup' '$libraryPath' -Force" -ForegroundColor Gray
