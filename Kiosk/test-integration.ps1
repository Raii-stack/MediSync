# MediSync Kiosk Testing Script
# This script provides easy commands to test the RFID and Vitals integration

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('rfid', 'vitals', 'status', 'all')]
    [string]$TestType = 'all'
)

$baseUrl = "http://localhost:3001"

Write-Host "`n🧪 MediSync Kiosk Testing Script`n" -ForegroundColor Cyan

function Test-RFID {
    param([string]$rfidUid = "RFID001")
    
    Write-Host "📡 Simulating RFID Tap: $rfidUid" -ForegroundColor Yellow
    
    $body = @{
        rfid_uid = $rfidUid
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/debug/rfid" -ContentType "application/json" -Body $body
        Write-Host "✅ RFID Simulation Success!" -ForegroundColor Green
        Write-Host "   Response: $($response.message)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

function Test-Vitals {
    param(
        [int]$bpm = 75,
        [double]$temp = 37.0,
        [int]$duration = 5
    )
    
    Write-Host "❤️  Simulating Vitals Data (Duration: ${duration}s)" -ForegroundColor Yellow
    Write-Host "   BPM: $bpm, Temperature: ${temp}°C" -ForegroundColor Gray
    
    $body = @{
        bpm = $bpm
        temp = $temp
        duration = $duration
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Method POST -Uri "$baseUrl/api/debug/vitals" -ContentType "application/json" -Body $body
        Write-Host "✅ Vitals Simulation Started!" -ForegroundColor Green
        Write-Host "   Response: $($response.message)" -ForegroundColor Gray
        Write-Host "   Watch the frontend for real-time updates..." -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

function Test-Status {
    Write-Host "📊 Checking Backend Status..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Method GET -Uri "$baseUrl/api/debug/status"
        Write-Host "✅ Backend Status:" -ForegroundColor Green
        Write-Host "   Debug Mode: $($response.debug_mode)" -ForegroundColor Gray
        Write-Host "   Connected Clients: $($response.connected_clients)" -ForegroundColor Gray
        Write-Host "   Message: $($response.message)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error connecting to backend. Is it running on port 3001?" -ForegroundColor Red
    }
}

function Show-Menu {
    Write-Host "`nAvailable Test Students:" -ForegroundColor Cyan
    Write-Host "  1. RFID001 - Ryan Dela Cruz (12-STEM)" -ForegroundColor Gray
    Write-Host "  2. RFID002 - Juan Reyes (11-ICT)" -ForegroundColor Gray
    Write-Host "  3. RFID003 - Maria Santos (12-ABM)" -ForegroundColor Gray
    Write-Host "  4. RFID004 - Pedro Garcia (11-HUMSS)" -ForegroundColor Gray
    Write-Host ""
}

# Main execution
switch ($TestType) {
    'rfid' {
        Show-Menu
        Test-RFID -rfidUid "RFID001"
    }
    'vitals' {
        Test-Vitals -bpm 75 -temp 37.0 -duration 5
    }
    'status' {
        Test-Status
    }
    'all' {
        Write-Host "Running Full Integration Test...`n" -ForegroundColor Cyan
        
        # Step 1: Check status
        Test-Status
        Start-Sleep -Seconds 1
        
        # Step 2: Simulate RFID tap
        Write-Host ""
        Show-Menu
        Test-RFID -rfidUid "RFID001"
        
        Write-Host "`n⏳ Waiting 3 seconds for frontend navigation..." -ForegroundColor Cyan
        Start-Sleep -Seconds 3
        
        # Step 3: Simulate vitals
        Write-Host ""
        Test-Vitals -bpm 75 -temp 37.0 -duration 10
        
        Write-Host "`n✨ Integration test complete!" -ForegroundColor Green
        Write-Host "   Check your browser at http://localhost:5173" -ForegroundColor Cyan
    }
}

Write-Host "`n📝 Usage Examples:" -ForegroundColor Cyan
Write-Host "   .\test-integration.ps1 -TestType rfid    # Test RFID only" -ForegroundColor Gray
Write-Host "   .\test-integration.ps1 -TestType vitals  # Test vitals only" -ForegroundColor Gray
Write-Host "   .\test-integration.ps1 -TestType status  # Check backend status" -ForegroundColor Gray
Write-Host "   .\test-integration.ps1 -TestType all     # Run full test" -ForegroundColor Gray
Write-Host ""
