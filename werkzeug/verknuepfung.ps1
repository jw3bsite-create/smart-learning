# =====================================================================
#  Legt die Verknüpfung Smart Learning auf dem Schreibtisch an.
#
#  Aufruf (Rechtsklick auf die Datei, Mit PowerShell ausfuehren) oder:
#    powershell -ExecutionPolicy Bypass -File werkzeug\verknuepfung.ps1
#
#  Die Verknüpfung zeigt unmittelbar auf PowerShell und nicht auf eine
#  Stapeldatei: Eine Stapeldatei bringt immer ein schwarzes Fenster mit, das
#  kurz aufblitzt. So bleibt der Start still.
# =====================================================================

$ErrorActionPreference = "Stop"

$Ordner  = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Starter = Join-Path $Ordner "werkzeug\starten.ps1"
$Symbol  = Join-Path $Ordner "public\symbol.ico"

foreach ($datei in @($Starter, $Symbol)) {
  if (-not (Test-Path $datei)) { throw "Nicht gefunden: $datei" }
}

# Der Schreibtisch liegt bei eingerichtetem OneDrive nicht dort, wo man ihn
# vermutet — Windows selbst fragen statt raten.
$Schreibtisch = [Environment]::GetFolderPath("Desktop")
$Ziel = Join-Path $Schreibtisch "Smart Learning.lnk"

# Die Verknüpfung unter dem alten Namen wegräumen, sonst liegen zwei da.
$frueher = Join-Path $Schreibtisch "Karteikasten.lnk"
if (Test-Path $frueher) { Remove-Item $frueher -Force -ErrorAction SilentlyContinue }

$schale = New-Object -ComObject WScript.Shell
$v = $schale.CreateShortcut($Ziel)
$v.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$v.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Starter`""
$v.WorkingDirectory = $Ordner
$v.IconLocation = "$Symbol,0"
$v.Description = "Smart Learning starten"
$v.WindowStyle = 7           # kleingelegt — das Fenster von PowerShell bleibt unsichtbar
$v.Save()

Write-Host "Verknüpfung angelegt: $Ziel"
