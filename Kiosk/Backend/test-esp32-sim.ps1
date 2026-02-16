# Test ESP32 Integration & Simulation
# Run this after starting the backend with: npm run dev

$backend = "http://localhost:3001"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ESP32 INTEGRATION TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Send Fake RFID to ESP32 (triggers vitals reading)
Write-Host "[TEST 1] Sending Fake RFID to ESP32..." -ForegroundColor Yellow
Write-Host "This will make the ESP32 start reading vitals!" -ForegroundColor White
$rfidResponse = Invoke-RestMethod -Uri "$backend/api/debug/esp32-rfid" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"uid":"TEST12345678"}'

Write-Host "Response: $($rfidResponse | ConvertTo-Json)" -ForegroundColor Green
Write-Host "`nExpected ESP32 behavior:" -ForegroundColor Yellow
Write-Host "  - Status LED turns GREEN" -ForegroundColor White
Write-Host "  - Success tone plays (2 beeps)" -ForegroundColor White
Write-Host "  - Progress LED shows red->green gradient" -ForegroundColor White
Write-Host "  - Starts reading temperature and heart rate" -ForegroundColor White
Write-Host "  - Completes after 5 seconds with vitals data" -ForegroundColor White
Start-Sleep -Seconds 7

# Test 2: Dispense Medicine from Slot 1
Write-Host "`n[TEST 2] Dispensing from Slot 1..." -ForegroundColor Yellow
$dispenseResponse = Invoke-RestMethod -Uri "$backend/api/dispense" `
    -Method POST `
    -ContentType "application/json" `
    -Body @"
{
    "medicine": "Bioflu",
    "student_id": "TEST001",
    "student_name": "Test Student",
    "symptoms": ["headache", "fever"],
    "pain_level": 5,
    "vitals": {
        "temperature": 37.5,
        "heartRate": 80
    }
}
"@

Write-Host "Response: $($dispenseResponse | ConvertTo-Json)" -ForegroundColor Green
Start-Sleep -Seconds 2

# Test 3: Check Available Slots
Write-Host "`n[TEST 3] Checking Available Slots..." -ForegroundColor Yellow
$slotsResponse = Invoke-RestMethod -Uri "$backend/api/slots" -Method GET

Write-Host "Current Slots:" -ForegroundColor Green
$slotsResponse | ForEach-Object {
    Write-Host "  Slot $($_.slot_id): $($_.medicine_name) (Stock: $($_.current_stock))" -ForegroundColor White
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TESTS COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Check the backend terminal for ESP32 messages:" -ForegroundColor Yellow
Write-Host "  - [SIM] 🔖 RFID simulation" -ForegroundColor White
Write-Host "  - 📤 Sent to ESP32: JSON dispense command" -ForegroundColor White
Write-Host "  - [SIM] 💊 Dispensing Servo X" -ForegroundColor White
