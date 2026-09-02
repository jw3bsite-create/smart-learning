# =====================================================================
#  Startet Smart Learning und öffnet die App in einem eigenen Fenster.
#
#  Läuft der Server schon, wird er nicht noch einmal gestartet — dann geht
#  bloß das Fenster auf. Der Server selbst liegt in einem zweiten,
#  kleingelegten Fenster; wer es schließt, beendet ihn.
#
#  Warum PowerShell und nicht schlicht eine Stapeldatei: Die Prüfung, ob der
#  Server schon läuft, muss unabhängig von der Sprache des Systems sein. Der
#  erste Versuch las die Ausgabe von netstat nach LISTENING — auf einem
#  deutschen Windows steht dort ABHÖREN, und der Starter hätte bei jedem Mal
#  vergeblich gewartet. Ein Verbindungsversuch antwortet in jeder Sprache
#  gleich.
# =====================================================================

$ErrorActionPreference = "Stop"

$Ordner   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Port     = 5180
$Adresse  = "http://localhost:$Port"
$NodePfad = "C:\Program Files\nodejs"

function Melde($text, $art = "Information") {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($text, "Smart Learning",
    [System.Windows.Forms.MessageBoxButtons]::OK, $art) | Out-Null
}

# Antwortet jemand auf dem Port? Ein Verbindungsversuch — der faellt in
# jeder Sprache gleich aus.
function Antwortet {
  # Beide Wege einzeln: Der Server bindet sich je nach Windows an ::1 oder an
  # 127.0.0.1, und ein TcpClient ohne Angabe spricht nur IPv4. Mit Frist, weil
  # ein nicht belegter Port hier nicht abgelehnt, sondern verschluckt wird —
  # ohne Frist wartet jede Runde vier Sekunden.
  $wege = @(
    @("127.0.0.1", [Net.Sockets.AddressFamily]::InterNetwork),
    @("::1",       [Net.Sockets.AddressFamily]::InterNetworkV6)
  )
  foreach ($weg in $wege) {
    $klient = New-Object Net.Sockets.TcpClient($weg[1])
    try {
      $versuch = $klient.BeginConnect($weg[0], $Port, $null, $null)
      if ($versuch.AsyncWaitHandle.WaitOne(300)) {
        # EndConnect wirft, wenn abgelehnt wurde. Ohne diesen Aufruf bleibt
        # Connected falsch, auch wenn die Verbindung steht — daran ist der
        # erste Anlauf gescheitert.
        $klient.EndConnect($versuch)
        return $true
      }
    } catch { } finally { $klient.Close() }
  }
  return $false
}

<#
  Benennt das Fenster des Servers.

  Der Umweg ist noetig, weil Vite den Titel der Konsole beim Start
  ueberschreibt: Ein `title`-Befehl in der Stapeldatei wirkt, wird aber
  Sekundenbruchteile spaeter wieder weggeraeumt. Das Fenster hiesse dann
  cmd.exe und waere in der Leiste nicht wiederzufinden, wenn man den Server
  beenden will.

  Also von aussen, nachdem der Server steht: kurz an dessen Konsole
  anhaengen, den Titel setzen, wieder loesen.
#>
$ConsoleWerkzeug = @'
using System;
using System.Runtime.InteropServices;
public static class Konsole {
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool SetConsoleTitleW(string titel);
}
'@

function Benenne($pid_, $titel) {
  try {
    Add-Type -TypeDefinition $ConsoleWerkzeug -ErrorAction Stop
  } catch {
    # Schon geladen — das ist kein Grund, den Start abzubrechen.
  }
  try {
    [Konsole]::FreeConsole() | Out-Null
    if ([Konsole]::AttachConsole([uint32]$pid_)) {
      [Konsole]::SetConsoleTitleW($titel) | Out-Null
      [Konsole]::FreeConsole() | Out-Null
    }
  } catch {
    # Ein unbenanntes Fenster ist ein Schoenheitsfehler, kein Fehlschlag.
  }
}

# --------------------------- Ist Node da? ---------------------------
if (Test-Path (Join-Path $NodePfad "node.exe")) {
  $env:Path = "$NodePfad;$env:Path"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Melde ("Node.js wurde nicht gefunden.`n`nErwartet wird es unter:`n$NodePfad`n`n" +
    "Ohne Node kann Smart Learning nicht starten. Node gibt es unter " +
    "https://nodejs.org — die Fassung mit LTS im Namen genügt.") "Error"
  exit 1
}

# ----------------------- Läuft er vielleicht schon? -----------------------
if (-not (Antwortet)) {

  # Beim ersten Mal fehlen die Pakete. Das dauert und braucht ein sichtbares
  # Fenster — sonst sitzt man vor nichts und weiß nicht, ob etwas geschieht.
  if (-not (Test-Path (Join-Path $Ordner "node_modules\vite"))) {
    $lauf = Start-Process -FilePath "cmd.exe" -WorkingDirectory $Ordner -Wait -PassThru `
      -ArgumentList "/c", "npm install"
    if ($lauf.ExitCode -ne 0) {
      Melde "Das Laden der Pakete ist fehlgeschlagen (Rückgabe $($lauf.ExitCode))." "Error"
      exit 1
    }
  }

  $serverfenster = Start-Process -FilePath (Join-Path $Ordner "werkzeug\server.cmd") `
    -WorkingDirectory $Ordner -WindowStyle Minimized -PassThru

  # Warten, bis der Server antwortet — höchstens eine Minute.
  $bis = (Get-Date).AddSeconds(60)
  while (-not (Antwortet)) {
    if ((Get-Date) -gt $bis) {
      Melde ("Der Server ist nach einer Minute noch nicht bereit.`n`n" +
        "Sieh im kleingelegten Fenster nach — es heißt Smart Learning – Server.") "Warning"
      exit 1
    }
    Start-Sleep -Milliseconds 400
  }

  Benenne $serverfenster.Id "Smart Learning – Server (schliessen beendet ihn)"
}

# --------------------------- Fenster öffnen ---------------------------
# Am liebsten ohne Adresszeile und Lesezeichen — dann sieht es aus wie ein
# eigenes Programm und nicht wie eine Seite.
$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browser) {
  # Ein eigenes Fenstermerkmal, damit die App eine eigene Schaltflaeche in der
  # Leiste bekommt und nicht unter den uebrigen Seiten verschwindet.
  #
  # Der Ordner heisst weiter nach dem alten Namen der App, und das bleibt so.
  # In ihm liegt die Datenbank des Browserprofils — saemtliche Karten und der
  # ganze Lernstand. Ein Umzug war hier schon eingebaut und ist beim Pruefen
  # gescheitert: Der neue Ordner entstand, die Daten blieben im alten liegen.
  # In der Hand des Nutzers haette das ausgesehen, als sei alles weg. Ein
  # unsichtbarer Ordnername ist diesen Preis nicht wert.
  $eigen = Join-Path $env:LOCALAPPDATA "Karteikasten\Browser"

  Start-Process $browser -ArgumentList "--app=$Adresse", "--user-data-dir=`"$eigen`""
} else {
  Start-Process $Adresse
}
