# =====================================================================
#  Legt die Verknüpfung „Anchor (alte Fassung)“ auf dem Schreibtisch an.
#
#  Sie startet die Fassung über den eigenen Rechner (localhost). Die
#  eigentliche App am PC ist seit Oktober 2026 die veröffentlichte Seite, in
#  Edge als App installiert — Edge legt dafür selbst eine Verknüpfung
#  „Anchor“ an. Diese hier bleibt für den Umzug (siehe src/core/umzug.js)
#  und zum Entwickeln.
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
$Ziel = Join-Path $Schreibtisch "Anchor (alte Fassung).lnk"

# Die Verknüpfung unter dem alten Namen wegräumen, sonst liegen zwei da.
# „Anchor.lnk“ nur, wenn sie auf diesen Starter zeigt — die von Edge
# angelegte App-Verknüpfung heißt ebenso und bleibt unangetastet.
$schale0 = New-Object -ComObject WScript.Shell
foreach ($alt in @("Karteikasten.lnk", "Smart Learning.lnk", "Deep Learning.lnk",
                   "Deep Dive.lnk", "Anchor.lnk")) {
  $frueher = Join-Path $Schreibtisch $alt
  if (-not (Test-Path $frueher)) { continue }
  if ($alt -eq "Anchor.lnk" -and $schale0.CreateShortcut($frueher).Arguments -notlike "*starten.ps1*") { continue }
  Remove-Item $frueher -Force -ErrorAction SilentlyContinue
}

$schale = New-Object -ComObject WScript.Shell
$v = $schale.CreateShortcut($Ziel)
$v.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$v.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Starter`""
$v.WorkingDirectory = $Ordner
$v.IconLocation = "$Symbol,0"
$v.Description = "Anchor (alte Fassung über den eigenen Rechner) starten"
$v.WindowStyle = 7           # kleingelegt — das Fenster von PowerShell bleibt unsichtbar
$v.Save()

Write-Host "Verknüpfung angelegt: $Ziel"

# ---------------------------------------------------------------------
#  Und die eigentliche App: die veröffentlichte Fassung in einem eigenen
#  Edge-Fenster ohne Adresszeile. Kein Server, offline nutzbar, Push.
#  Die Daten liegen im selben Speicher wie beim Öffnen der Seite in Edge —
#  also auch dort, wohin der Umzug aus der alten Fassung sie bringt.
# ---------------------------------------------------------------------
$Adresse = "https://jw3bsite-create.github.io/smart-learning/"
$Edge = @(
  (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" -ErrorAction SilentlyContinue).'(default)',
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($Edge) {
  $App = Join-Path $Schreibtisch "Anchor.lnk"
  $a = $schale.CreateShortcut($App)
  $a.TargetPath = $Edge
  $a.Arguments = "--app=$Adresse"
  $a.IconLocation = "$Symbol,0"
  $a.Description = "Anchor"
  $a.Save()
  Write-Host "Verknüpfung angelegt: $App"
} else {
  Write-Host "Edge nicht gefunden — die Verknüpfung zur App wurde nicht angelegt."
}
