# 가사 오버레이 — 바탕이 완전히 투명한 가사 창 (이 프로그램의 유일한 오버레이)
# 플레이어가 지금 곡·가사 묶음을 이 창의 창구(http://127.0.0.1:47613)로 알려 주면 overlay\now_playing.json 에 써 두고
# 이 창이 읽어서 보여 줌. 브라우저 창이 아니라서 어느 브라우저를 써도 바탕 투명·클릭 통과가 됨.
#
# 실행: 한 번 켜 두면 뒤에서 계속 돌고(숨어 있을 때는 거의 일하지 않음), 화면의 '오버레이 켜기/끄기' 단추는 보이기·숨기기만 함
#       (설정 파일의 enabled — 어느 브라우저든, 서버가 없어도 바로). 켜 두는 방법:
#       · 서버를 켜면 서버가 뒤에서 띄움 (-Background: 보이기·숨기기는 지난 상태 그대로)
#       · 서버 없이 쓸 때는 lyrics_overlay.bat 을 한 번 더블클릭 (보이기로 바뀜 · 이미 켜져 있으면 보이기만 함)
#       켤 때마다 이 컴퓨터 사용자에 'musicoverlay:' 링크도 등록 (HKCU\Software\Classes\musicoverlay — 링크로 켜 주는 브라우저용)
#       완전히 끄기: 알림 영역 아이콘 → 종료 (또는 설정 파일의 quit_at)
# 설정: 플레이어·바깥 틀의 ⚙ → '가사 오버레이 설정' 창 (WEB\overlay\lyrics_overlay.json — 바꾸면 곧바로 반영)
#       붙일 프로그램(그 창이 앞에 있을 때만 보임) · 클릭 통과 · 곡 정보 줄 · 글자 크기 · 테두리 두께 · 불투명도 · 가로 폭 · 위치 처음으로
#       설정 창이 열려 있는 동안은 붙일 프로그램과 상관없이 보이고 끌어 옮길 수 있음 (닫으면 원래대로)
# 알림 영역 아이콘(우클릭): 클릭 통과 · 종료
# 발음·번역 줄은 플레이어의 '발음'·'번역' 체크를 그대로 따름. 플레이어가 15초 넘게 소식이 없으면(닫힘) 가사를 숨김

param(
    [Parameter(Position = 0)][string]$Url = '',   # 'musicoverlay:start' 링크로 켰을 때 (bat 처럼 보이기)
    [switch]$Background,    # 서버가 뒤에서 띄울 때: 보이기·숨기기는 지난 상태 그대로, 이미 켜져 있으면 그냥 끝냄
    [int]$Test = 0,         # 시험: 화면 밖에 띄우고 이 초만큼 뒤에 그린 글자를 출력하고 끝냄
    [string]$NowFile = '',  # 시험: 플레이어 소식 파일을 다른 곳에서 (프로그램 목록도 그 폴더에 씀)
    [string]$CfgFile = ''   # 시험: 설정 파일을 다른 곳에서
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms, System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public class OvWin {
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int idx);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int idx, int val);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    public static uint ForegroundPid() { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); return pid; }
    public static void KeepOnTop(IntPtr h) { SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x1 | 0x2 | 0x10); }  // HWND_TOPMOST · 크기·위치 그대로 · 초점 안 뺏음
}
'@

$GWL_EXSTYLE = -20
$WS_EX_TRANSPARENT = 0x20; $WS_EX_TOOLWINDOW = 0x80; $WS_EX_LAYERED = 0x80000; $WS_EX_NOACTIVATE = 0x8000000

# 오버레이 버전 (user request 2026-11-19): the player compares it (/ovprograms ver) with this file in its own tools/ folder
# and asks for the new zip when the running one is older — bump it with every change of this file
$OV_VER = 9   # 3: a newer bat replaces a running older overlay by itself · 4: parts (names, side by side) · 5: no terminal window (conhost --headless) · 6: negative x kept (no jump back to the middle) · width grows both sides · 7: place = centre, fitted to its monitor (4K · wide · dual) · 가로 폭 in % of the monitor · 정렬 · /frame (구역 표시) · 8: updates itself from music_front main (start · hourly) · 9: owner — only the page that turned it on is shown
# data folder overlay\: next to tools\ in the player repo; next to this file elsewhere (가사 오버레이 켜기.bat puts it in
# %USERPROFILE%\MusicPlayerOverlay — play_engine.js ovBat), so a new version of this file keeps the settings
$script:Root = if ((Split-Path -Leaf $PSScriptRoot) -eq 'tools') { Split-Path -Parent $PSScriptRoot } else { $PSScriptRoot }
$script:NowFile = if ($NowFile) { $NowFile } else { Join-Path $script:Root 'overlay\now_playing.json' }
$script:CfgFile = if ($CfgFile) { $CfgFile } else { Join-Path $script:Root 'overlay\lyrics_overlay.json' }
$script:ProgFile = Join-Path (Split-Path $script:NowFile) 'overlay_programs.json'
try { New-Item -ItemType Directory -Force (Split-Path $script:ProgFile) | Out-Null } catch {}  # WEB\overlay is not in the zip/git
$STALE_MS = 15000   # 플레이어가 5초마다 알려 줌 → 이만큼 소식이 없으면 닫힌 것으로 보고 숨김
$EDIT_MS = 8000     # 설정 창이 3초마다 '열려 있음'을 알려 줌 → 이만큼 소식이 없으면 닫힌 것으로
$UTF8 = New-Object Text.UTF8Encoding $false

# ---- 설정 (⚙ 설정 창에서 바꿈 · 위치는 끌어 옮길 때 이 창이 씀) — 서버 web_api\lyrics_overlay_files.py 와 같은 기본값 ----
$DEFAULTS = @{ x = -1; y = -1; cx = $null; width = 1100; width_pct = $null; align = 'center'; size = 22; info_size = 12; outline = 2; opacity = 100; clickthrough = $false; target = 'ffxiv_dx11'; info = $true; editing_at = 0; quit_at = 0; enabled = $true; font_bold_ja = $false; font_bold_etc = $false; font_ja = ''; font_etc = ''; owner = '' }
$script:cfg = $DEFAULTS.Clone()
$script:cfgWrite = [datetime]::MinValue
function Read-Json($path) { [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json }
function Read-Cfg {  # 파일이 바뀌었으면 읽어서 반영 → 바뀌었으면 $true
    try {
        $t = [IO.File]::GetLastWriteTimeUtc($script:CfgFile)
        if ($t -eq $script:cfgWrite) { return $false }
        $saved = Read-Json $script:CfgFile
        $script:cfgWrite = $t
        foreach ($k in @($DEFAULTS.Keys)) { $script:cfg[$k] = $(if ($null -ne $saved.$k) { $saved.$k } else { $DEFAULTS[$k] }) }
        return $true
    } catch { return $false }  # 아직 없음 · 화면이 막 쓰는 중
}
function Update-CfgFile($patch) {  # 이 창이 바꾼 값만 파일에 (다른 설정은 화면이 쓴 그대로)
    if ($Test) { return }
    try {
        $d = [ordered]@{}
        foreach ($k in $DEFAULTS.Keys) { $d[$k] = $script:cfg[$k] }
        if (Test-Path $script:CfgFile) { (Read-Json $script:CfgFile).PSObject.Properties | ForEach-Object { $d[$_.Name] = $_.Value } }
        foreach ($k in $patch.Keys) { $d[$k] = $patch[$k] }
        New-Item -ItemType Directory -Force (Split-Path $script:CfgFile) | Out-Null
        [IO.File]::WriteAllText($script:CfgFile, ($d | ConvertTo-Json), $UTF8)
        $script:cfgWrite = [IO.File]::GetLastWriteTimeUtc($script:CfgFile)
    } catch {}
}
[void](Read-Cfg)
function Get-Epoch { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Test-Editing { ((Get-Epoch) - [double]$script:cfg.editing_at) -lt $EDIT_MS }   # 설정 창이 열려 있음
$script:editing = Test-Editing

# ---- 자동 업데이트 (user request 2026-11-20: like the extension, the overlay takes its program from the public music_front repo
# by itself) — at every start (bat · [오버레이] button link) and every hour while running: when main's file has a higher $OV_VER
# it replaces this file and starts it (the newer one tells this one to quit — 한 번만 켜기 below). Not the player repo's own
# tools\ copy (git keeps that one). MPX_OV_SRC: another address (tests only). Offline / no answer in 5 s → goes on as it is.
$OV_SRC = if ($env:MPX_OV_SRC) { $env:MPX_OV_SRC } else { 'https://raw.githubusercontent.com/AILEE126/music_front/main/tools/lyrics_overlay.ps1' }
function Update-Self {
    if ((Split-Path -Leaf $PSScriptRoot) -eq 'tools') { return $false }
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $req = [Net.WebRequest]::Create($OV_SRC)
        $req.Timeout = 5000
        $req.CachePolicy = New-Object Net.Cache.RequestCachePolicy([Net.Cache.RequestCacheLevel]::NoCacheNoStore)
        $res = $req.GetResponse()
        try { $new = (New-Object IO.StreamReader($res.GetResponseStream(), [Text.Encoding]::UTF8)).ReadToEnd() } finally { $res.Close() }
        $m = [regex]::Match($new, '\$OV_VER\s*=\s*(\d+)')
        # only a whole, newer overlay that still updates itself
        if (-not $m.Success -or [int]$m.Groups[1].Value -le $OV_VER -or $new -notmatch 'function Update-Self') { return $false }
        [IO.File]::WriteAllText($PSCommandPath, $new.TrimStart([char]0xFEFF).Replace("`r`n", "`n").Replace("`n", "`r`n"), (New-Object Text.UTF8Encoding $true))
        $a = '--headless "{0}" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}"' -f (Join-Path $PSHOME 'powershell.exe'), $PSCommandPath
        if ($Background) { $a += ' -Background' }
        if ($Test) { $a += ' -Test {0}' -f $Test }
        if ($NowFile) { $a += ' -NowFile "{0}"' -f $NowFile }
        if ($CfgFile) { $a += ' -CfgFile "{0}"' -f $CfgFile }
        Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\conhost.exe') -ArgumentList $a -WindowStyle Hidden
        return $true
    } catch { return $false }
}
if ((-not $Test -or $env:MPX_OV_SRC) -and (Update-Self)) { return }   # the new file runs instead

# ---- 한 번만 켜기 ----
$created = $false
$script:mutex = New-Object System.Threading.Mutex($true, 'MusicManagerLyricsOverlay', [ref]$created)
# 새 버전 (user request 2026-11-19: unzip the new version over the old one and double-click the bat — nothing else): a
# running overlay older than this file is told to quit (quit_at through its own /ovset), and this one takes over once it is gone
if (-not $created -and -not $Test) {
    $old = $null
    try { $old = Invoke-RestMethod -Uri 'http://127.0.0.1:47613/ovprograms' -TimeoutSec 3 } catch {}
    if ($old -and [int]$old.ver -lt $OV_VER) {
        try { Invoke-RestMethod -Uri 'http://127.0.0.1:47613/ovset' -Method Post -Body (@{ quit_at = (Get-Epoch) } | ConvertTo-Json) -TimeoutSec 3 | Out-Null } catch {}
        try { $created = $script:mutex.WaitOne(15000) } catch [System.Threading.AbandonedMutexException] { $created = $true }
    }
}
if (-not $created -and -not $Test) {
    if (-not $Background) { Update-CfgFile @{ enabled = $true } }   # 이미 뒤에서 도는 중: bat·링크로 켰으면 보이기만
    return
}
$script:startedAt = Get-Epoch   # 이보다 나중의 quit_at 을 보면 끝냄
if (-not $Background -and -not $Test) { Update-CfgFile @{ enabled = $true } }   # bat·링크로 켰으면 보이기

# ---- 'musicoverlay:' 링크 등록 (이 컴퓨터 사용자에만 · 이 파일 위치가 바뀌어도 켤 때마다 다시 맞춤) ----
function Register-Link {
    $key = 'HKCU:\Software\Classes\musicoverlay'
    $ps = Join-Path $PSHOME 'powershell.exe'
    New-Item -Path "$key\shell\open\command" -Force | Out-Null
    Set-Item -Path $key -Value 'URL:가사 오버레이'
    New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    # conhost --headless: no terminal window left in the taskbar (same as the bat)
    $ch = Join-Path $env:SystemRoot 'System32\conhost.exe'
    Set-Item -Path "$key\shell\open\command" -Value ('"{0}" --headless "{1}" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{2}" "%1"' -f $ch, $ps, $PSCommandPath)
}
if (-not $Test) { try { Register-Link } catch {} }

# ---- 창 ----
$w = New-Object System.Windows.Window
$w.Title = '가사 오버레이'
$w.WindowStyle = 'None'; $w.AllowsTransparency = $true; $w.ResizeMode = 'NoResize'
$w.Background = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.Color]::FromArgb(1, 0, 0, 0))  # 눈에 안 보이지만 끌어 옮길 수 있게
$w.Topmost = $true; $w.ShowInTaskbar = $false; $w.SizeToContent = 'Height'
$w.ShowActivated = $false   # 다시 보일 때 게임에서 초점을 뺏지 않음
$w.WindowStartupLocation = 'Manual'
$script:panel = New-Object System.Windows.Controls.StackPanel
$script:panel.Margin = '10,6,10,6'
# 구역 표시 (user request 2026-11-20): a blue dashed line round the window while the player's ⚙ 설정 is open (POST /frame
# every 3 s) — only drawn, the overlay is not forced on and click-through is unchanged (forcing it on looked like a bug, 2026-11-19)
$script:frame = New-Object System.Windows.Shapes.Rectangle
$script:frame.Stroke = (New-Object System.Windows.Media.BrushConverter).ConvertFromString('#3d8bff')
$script:frame.StrokeThickness = 2; $script:frame.StrokeDashArray = (New-Object System.Windows.Media.DoubleCollection (,[double[]](4, 3)))
$script:frame.Visibility = 'Collapsed'
$script:root = New-Object System.Windows.Controls.Grid
[void]$script:root.Children.Add($script:panel); [void]$script:root.Children.Add($script:frame)
$w.Content = $script:root
$script:frameAt = 0
$FRAME_MS = 8000
function Set-Frame {
    $on = ((Get-Epoch) - $script:frameAt) -lt $FRAME_MS
    $vis = $(if ($on) { 'Visible' } else { 'Collapsed' })
    if ($script:frame.Visibility -ne $vis) { $script:frame.Visibility = $vis }
}
# 높이 고정 (user request 2026-11-20): the window is always as tall as the info line + a part name + three lyric lines
# (원문 · 발음 · 번역) at the set sizes, lyrics or not — so the area doesn't jump between songs; more lines (wrapping) still grow it
function Set-MinHeight {
    $o = 2.0 * [Math]::Max(0.0, [double]$script:cfg.outline)
    $s = [Math]::Max(6.0, [double]$script:cfg.size)
    $h = 12.0 + ([Math]::Max(9.0, [Math]::Round($s * 0.5)) * 1.15 + $o) + 3 * ($s * 1.15 + $o)   # 12 = the panel's margin
    if ($script:cfg.info) { $h += [Math]::Max(6.0, [double]$script:cfg.info_size) * 1.15 + $o }
    $script:root.MinHeight = [Math]::Ceiling($h)
}
# 정렬 (user request 2026-11-20): 왼쪽 · 가운데 · 오른쪽 — lines inside the window (and side-by-side parts as a row)
function Get-Align { switch ([string]$script:cfg.align) { 'left' { 'Left' } 'right' { 'Right' } default { 'Center' } } }
# 위치 (user report 2026-11-20, 4K at 175%: the lyrics jumped to odd places on song changes): the place is kept as the lyrics'
# centre (cx) + top (y) in WPF units, and the window is fitted into the monitor holding that centre — never wider than its
# work area (a 3000 wide window on a 2341 wide screen was cut by Windows while the text was laid out for 3000), never off it.
# Works the same on wide screens and on any monitor of several; a monitor change (unplugged, resolution) re-fits it.
$script:dpiK = 1.0   # WPF unit → screen pixel (this process is system-DPI aware: Forms.Screen gives pixels)
try { $g = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero); $script:dpiK = $g.DpiX / 96.0; $g.Dispose() } catch {}
function Get-WorkArea($cx, $cy) {  # the work area (WPF units) of the monitor nearest to that point · $null = the main one
    $s = $(if ($null -eq $cx) { [System.Windows.Forms.Screen]::PrimaryScreen }
           else { [System.Windows.Forms.Screen]::FromPoint((New-Object System.Drawing.Point ([int]($cx * $script:dpiK)), ([int]($cy * $script:dpiK)))) })
    $r = $s.WorkingArea; $k = $script:dpiK
    New-Object System.Windows.Rect ($r.Left / $k), ($r.Top / $k), ($r.Width / $k), ($r.Height / $k)
}
function Get-ScreensKey { ([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { "$($_.Bounds)" }) -join ';' }
$script:screensKey = Get-ScreensKey
function Set-Place {  # 위치·폭 (x·y 가 둘 다 -1 이면 화면 아래 가운데 — 설정 창의 '위치 처음으로') · 불투명도는 줄마다 (Add-Line)
    if ($Test) { $w.Width = [Math]::Max(200.0, [double]$script:cfg.width); $w.Left = -30000; $w.Top = -30000; return }
    # only the exact -1,-1 marker resets: a negative x is a real place (monitor left of the main one)
    $reset = [double]$script:cfg.x -eq -1 -and [double]$script:cfg.y -eq -1
    if (-not $reset -and $null -eq $script:cfg.cx) {  # older file: x = the window's left edge, the text was centred on its width
        $script:cfg.cx = [int]([double]$script:cfg.x + [Math]::Max(200.0, [double]$script:cfg.width) / 2); Update-CfgFile @{ cx = $script:cfg.cx }
    }
    $wa = $(if ($reset) { Get-WorkArea $null $null } else { Get-WorkArea ([double]$script:cfg.cx) ([double]$script:cfg.y) })
    # 가로 폭 = % of the monitor it is on (user request 2026-11-20: a number didn't fit 4K · wide · dual screens alike);
    # an older file's number becomes its share of this monitor once
    if ($null -eq $script:cfg.width_pct) {
        $script:cfg.width_pct = [int][Math]::Min(100, [Math]::Max(20, [Math]::Round([double]$script:cfg.width / $wa.Width * 20) * 5))
        Update-CfgFile @{ width_pct = $script:cfg.width_pct }
    }
    $ww = [Math]::Max(200.0, $wa.Width * [Math]::Min(100.0, [Math]::Max(10.0, [double]$script:cfg.width_pct)) / 100.0)
    $w.Width = $ww
    if ($reset) { $w.Left = $wa.Left + ($wa.Width - $ww) / 2; $w.Top = $wa.Bottom - 260; return }
    # 가로 폭 grows both sides (user request 2026-11-20) — the centre stays; kept inside the monitor
    $w.Left = [Math]::Min([Math]::Max([double]$script:cfg.cx - $ww / 2, $wa.Left), $wa.Right - $ww)
    $w.Top = [Math]::Min([Math]::Max([double]$script:cfg.y, $wa.Top), $wa.Bottom - 40)
}
Set-Place
Set-MinHeight

function Get-Hwnd { (New-Object System.Windows.Interop.WindowInteropHelper $w).Handle }
function Set-ExStyle {  # 작업 전환(Alt+Tab)에 안 보이고, 눌러도 게임에서 초점을 뺏지 않음 · 클릭 통과 (설정 창이 열려 있으면 끔 — 옮길 수 있게)
    $h = Get-Hwnd
    if ($h -eq [IntPtr]::Zero) { return }
    $ex = [OvWin]::GetWindowLong($h, $GWL_EXSTYLE) -bor $WS_EX_TOOLWINDOW -bor $WS_EX_NOACTIVATE -bor $WS_EX_LAYERED
    if ($script:cfg.clickthrough -and -not $script:editing) { $ex = $ex -bor $WS_EX_TRANSPARENT } else { $ex = $ex -band (-bnot $WS_EX_TRANSPARENT) }
    [void][OvWin]::SetWindowLong($h, $GWL_EXSTYLE, $ex)
}

# ---- 앞에 있는 프로그램 (붙일 프로그램이 켜져 있으면 그 창이 앞에 있을 때만 보임) ----
$script:pidName = @{}
function Get-PidName([uint32]$id) {
    if (-not $script:pidName.ContainsKey($id)) { $script:pidName[$id] = (Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName }
    $script:pidName[$id]
}
$script:targetRunning = $false
function Test-ShowNow {
    $t = ([string]$script:cfg.target) -replace '\.exe$', ''
    if (-not $t -or -not $script:targetRunning) { return $true }   # 프로그램을 안 정했거나 꺼져 있으면 늘 보임
    $fg = [OvWin]::ForegroundPid()
    if ($fg -eq $PID) { return $true }                              # 이 창을 잡아 옮기는 중
    (Get-PidName $fg) -eq $t
}
function Write-Programs {  # 창이 떠 있는 프로그램 목록 → 설정 창의 '붙일 프로그램' 고르기
    if ($Test -and -not $NowFile) { return }
    try {
        $list = @(Get-Process | Where-Object { $_.MainWindowTitle -and $_.Id -ne $PID } | Sort-Object ProcessName -Unique |
            ForEach-Object { [ordered]@{ exe = $_.ProcessName; title = $_.MainWindowTitle } })
        [IO.File]::WriteAllText($script:ProgFile, (ConvertTo-Json -InputObject $list -Depth 3), $UTF8)
    } catch {}
}

# ---- 글자: 테두리를 그리기 위해 글자를 도형으로 바꿔 검은 선(두께 = 설정의 테두리) 위에 채움 ----
# 플레이어가 밝은 화면이면 (now.light — user request 2026-11-18) 흰 테두리 + 어두운 글자, 보컬 색은 플레이어처럼 62% 로 어둡게
function Get-Light { [bool]($script:now -and $script:now.light) }
function Get-TextBrush { if (Get-Light) { (New-Object System.Windows.Media.BrushConverter).ConvertFromString('#323238') } else { [System.Windows.Media.Brushes]::White } }
function New-Brush($colors) {
    $cs = @($colors | Where-Object { $_ -match '^#[0-9a-fA-F]{6}$' })
    if (Get-Light) { $cs = @($cs | ForEach-Object { $c = $_; '#' + ((1, 3, 5 | ForEach-Object { '{0:x2}' -f [int]([Convert]::ToInt32($c.Substring($_, 2), 16) * 0.62) }) -join '') }) }
    if ($cs.Count -eq 0) { return (Get-TextBrush) }
    if ($cs.Count -eq 1) { return (New-Object System.Windows.Media.BrushConverter).ConvertFromString($cs[0]) }
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = '0,0'; $g.EndPoint = '0,1'
    for ($i = 0; $i -lt $cs.Count; $i++) {  # 여러 보컬(듀엣·합창): 위→아래 그라데이션 (플레이어와 같음)
        $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop ([System.Windows.Media.ColorConverter]::ConvertFromString($cs[$i])), ($i / ($cs.Count - 1))))
    }
    $g
}
$script:font = New-Object System.Windows.Media.FontFamily 'Malgun Gothic'
# kana · kanji with no 일본어 글꼴 picked: Yu Gothic (user request 2026-11-19) — Malgun Gothic draws kana tiny and has only
# Korean hanja, so kanji and kana came out in different sizes
$script:fontJa = New-Object System.Windows.Media.FontFamily 'Yu Gothic, Meiryo, Malgun Gothic'
# 글꼴 (user request 2026-11-18): the player's ⚙ 글꼴 picks — font_ja (kana · kanji, Chinese hanzi too) and font_etc (the rest)
# name font files the player sent to /font (overlay\fonts, ttf/otf — WPF reads no woff). '' or a missing file = Malgun Gothic
$script:fontDir = Join-Path (Split-Path $script:CfgFile) 'fonts'
$script:fontCache = @{}
function Get-OvFont([string]$file) {
    if (-not $file) { return $script:font }
    if ($script:fontCache.ContainsKey($file)) { return $script:fontCache[$file] }
    $p = Join-Path $script:fontDir $file
    if (-not (Test-Path $p)) { return $script:font }   # not kept: the player sends it soon
    $f = $script:font
    try {
        $name = @((New-Object System.Windows.Media.GlyphTypeface([Uri]$p)).Win32FamilyNames.Values)[0]
        $f = New-Object System.Windows.Media.FontFamily((New-Object Uri(($script:fontDir.TrimEnd('\') + '\'))), "./#$name, Malgun Gothic")
    } catch {}
    $script:fontCache[$file] = $f
    $f
}
# Japanese runs (same ranges as the player's font_setting.js): drawn with the Japanese pick
$JA_RE = '(?:[\u3000-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]|[\uD840-\uD8BF][\uDC00-\uDFFF])+'
# the text as WPF draws it (fonts by script, weights) — Add-Line draws it, Get-TextWidth measures a column (Show-Now)
function New-Ft($text, [double]$size, $brush, $weight) {
    $etc = Get-OvFont ([string]$script:cfg.font_etc); $ja = $(if ([string]$script:cfg.font_ja) { Get-OvFont ([string]$script:cfg.font_ja) } else { $script:fontJa })
    # 굵기 (user request 2026-11-19): a picked font is drawn at its own weight (WPF fakes bold for a one-weight font) unless
    # the player's ⚙ 글꼴 '굵게' is on for that pick
    $normal = [System.Windows.FontWeights]::Normal
    $wEtc = $(if ([string]$script:cfg.font_etc -and -not $script:cfg.font_bold_etc) { $normal } else { $weight })
    $wJa = $(if ([string]$script:cfg.font_ja -and -not $script:cfg.font_bold_ja) { $normal } else { $weight })
    $tf = New-Object System.Windows.Media.Typeface($etc, [System.Windows.FontStyles]::Normal, $wEtc, [System.Windows.FontStretches]::Normal)
    $ft = New-Object System.Windows.Media.FormattedText($text, [Globalization.CultureInfo]::CurrentUICulture, [System.Windows.FlowDirection]::LeftToRight, $tf, $size, $brush)
    foreach ($m in [regex]::Matches([string]$text, $JA_RE)) {
        if ($ja -ne $etc) { $ft.SetFontFamily($ja, $m.Index, $m.Length) }
        if ($wJa -ne $wEtc) { $ft.SetFontWeight($wJa, $m.Index, $m.Length) }
    }
    # fixed line height (user request 2026-11-19): the font's own was taller for lines with Yu Gothic (Japanese) than Malgun
    # Gothic ones, so the gap after a Japanese line looked wider; 1.15 × size = tighter and the same for every line
    $ft.LineHeight = $size * 1.15
    $ft
}
function Get-TextWidth($text, [double]$size, $weight) { (New-Ft $text $size (Get-TextBrush) $weight).WidthIncludingTrailingWhitespace }
# $parent / $maxW: a column of the side-by-side parts (Show-Now) — the line centred in that column's width
function Add-Line($text, [double]$size, $brush, [double]$opacity, $weight, $parent = $null, [double]$maxW = 0) {
    $o = [Math]::Max(0.0, [double]$script:cfg.outline)
    $ft = New-Ft $text $size $brush $weight
    $ft.MaxTextWidth = $(if ($maxW -gt 0) { [Math]::Max(30.0, $maxW) } else { [Math]::Max(50.0, $w.Width - 20.0 - 2.0 * $o) }); $ft.TextAlignment = (Get-Align)
    $geo = $ft.BuildGeometry((New-Object System.Windows.Point($o, $o)))
    $box = New-Object System.Windows.Controls.Grid
    $box.Width = $ft.MaxTextWidth + 2 * $o; $box.Height = $ft.Height + 2 * $o; $box.Tag = $text
    # 불투명도: outline + letters turn see-through as one layer ($grp). The opaque white copy under the letters (2026-11-18)
    # was dropped — it stayed white at any opacity (user report 2026-11-19)
    $a = $opacity * [Math]::Max(0.1, [Math]::Min(1.0, [double]$script:cfg.opacity / 100.0))
    $grp = New-Object System.Windows.Controls.Grid
    $grp.Opacity = $a
    [void]$box.Children.Add($grp)
    if ($o -gt 0) {
        $edge = New-Object System.Windows.Shapes.Path
        $edge.Data = $geo; $edge.Stroke = $(if (Get-Light) { [System.Windows.Media.Brushes]::White } else { [System.Windows.Media.Brushes]::Black }); $edge.StrokeThickness = 2 * $o; $edge.StrokeLineJoin = 'Round'
        [void]$grp.Children.Add($edge)
    }
    $fill = New-Object System.Windows.Shapes.Path
    $fill.Data = $geo; $fill.Fill = $brush
    [void]$grp.Children.Add($fill)
    [void]$(if ($parent) { $parent } else { $script:panel }).Children.Add($box)
}
function Show-Now {
    $script:panel.Children.Clear()
    $d = $script:now
    $s = [Math]::Max(6.0, [double]$script:cfg.size)
    $white = Get-TextBrush
    $alive = $d -and ((Get-Epoch) - [double]$d.at) -lt $STALE_MS
    if (-not $alive) {  # 재생 중인 곡이 없음: 설정 창이 열려 있을 때만 위치를 잡을 글자
        if ($script:editing) { Add-Line '가사 오버레이 — 끌어서 옮기세요' $s $white 1 ([System.Windows.FontWeights]::Bold) }
        return
    }
    if ($script:cfg.info -and $d.title) {
        # 곡 정보 줄 글자 크기: its own setting (user request 2026-11-19, was size × 0.55)
        Add-Line ($(if ($d.artist) { "$($d.title) — $($d.artist)" } else { $d.title })) ([Math]::Max(6.0, [double]$script:cfg.info_size)) $white 0.9 ([System.Windows.FontWeights]::SemiBold)
    }
    # 파트 (user request 2026-11-19): the part's name small above its lyrics, in the part's colors. Several singers at once
    # (cols) = side by side, each column centred on its own, a gap between, no '／'; a column is as wide as its longest line
    $ps = [Math]::Max(9.0, [Math]::Round($s * 0.5))
    $cols = @($d.cols | Where-Object { $_ })
    if ($cols.Count -gt 1) {
        $o = [Math]::Max(0.0, [double]$script:cfg.outline)
        $gap = $s * 1.5
        $cw = [Math]::Max(50.0, ($w.Width - 20.0 - $gap * ($cols.Count - 1)) / $cols.Count - 2.0 * $o)
        $row = New-Object System.Windows.Controls.StackPanel
        $row.Orientation = 'Horizontal'; $row.HorizontalAlignment = (Get-Align)
        for ($k = 0; $k -lt $cols.Count; $k++) {
            $c = $cols[$k]; $ls = @(Get-Shown $c.lines $d)
            $nat = ($ls | ForEach-Object { Get-TextWidth $_.text $s ([System.Windows.FontWeights]::Bold) } | Measure-Object -Maximum).Maximum
            if ($c.name) { $nat = [Math]::Max([double]$nat, (Get-TextWidth $c.name $ps ([System.Windows.FontWeights]::Bold))) }
            $mw = [Math]::Min($cw, [double]$nat + 2.0)
            $col = New-Object System.Windows.Controls.StackPanel
            if ($k -gt 0) { $col.Margin = "$gap,0,0,0" }
            if ($c.name) { Add-Line $c.name $ps (New-Brush $c.pcolors) 0.9 ([System.Windows.FontWeights]::Bold) $col $mw }
            Add-Lyrics $ls $s (New-Brush $c.colors) $col $mw
            [void]$row.Children.Add($col)
        }
        [void]$script:panel.Children.Add($row)
        return
    }
    if ($d.part -and $d.part.name) { Add-Line $d.part.name $ps (New-Brush $d.part.colors) 0.9 ([System.Windows.FontWeights]::Bold) }
    Add-Lyrics @(Get-Shown $d.lines $d) $s (New-Brush $d.colors)
}
# the lines the player asked for (발음 · 번역 checks; other-language lines come already picked)
function Get-Shown($lines, $d) { @($lines) | Where-Object { $_ -and ($_.role -eq 'o' -or $_.role -eq 'x' -or ($_.role -eq 'r' -and $d.show_r) -or ($_.role -eq 't' -and $d.show_t)) } }
function Add-Lyrics($ls, [double]$s, $brush, $parent = $null, [double]$maxW = 0) {
    foreach ($l in @($ls)) {
        # every lyric line one size (user request 2026-11-19 — a Korean- or English-only song = the Japanese line's size)
        if ($l.role -eq 'o') { Add-Line $l.text $s $brush 1 ([System.Windows.FontWeights]::Bold) $parent $maxW }
        elseif ($l.role -eq 'r') { Add-Line $l.text $s $brush 0.85 ([System.Windows.FontWeights]::SemiBold) $parent $maxW }
        else { Add-Line $l.text $s $brush 1 ([System.Windows.FontWeights]::SemiBold) $parent $maxW }
    }
}

# ---- 플레이어와 주고받는 창구: http://127.0.0.1:47613 (이 PC 안에서만) ----
# User request: the overlay works by just running the bat — the player never asks for a folder
# (a page opened from GitHub can't write files here). The page sends here; this writes the same files as before,
# so the rest of the overlay is unchanged. /now · /ovset (GET/POST) · /ovprograms (an answer = overlay is running) ·
# /fonts · /font (the ⚙ 글꼴 picks' files, 2026-11-18).
$OV_PORT = 47613
$script:http = $null
try { $script:http = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $OV_PORT); $script:http.Start() } catch { $script:http = $null }
$LATIN1 = [Text.Encoding]::GetEncoding(28591)   # bytes ↔ chars 1:1 (finding the header end in a UTF-8 request)
function Send-Http($s, [string]$body) {
    $b = $UTF8.GetBytes($body)
    $h = "HTTP/1.1 200 OK`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($b.Length)`r`n" +
        "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`n" +
        "Access-Control-Allow-Private-Network: true`r`nConnection: close`r`n`r`n"   # Chrome asks this for a public page → this PC
    $hb = [Text.Encoding]::ASCII.GetBytes($h)
    $s.Write($hb, 0, $hb.Length); if ($b.Length) { $s.Write($b, 0, $b.Length) }
}
function Read-Http($s) {  # → @{ method; path; query; body } (+ ms · start · len: the raw body, for /font)
    $buf = New-Object byte[] 65536; $ms = New-Object IO.MemoryStream; $end = -1; $len = 0
    while ($true) {
        $n = $s.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
        $ms.Write($buf, 0, $n)
        if ($end -lt 0) {   # header not found yet — decoded only until then (a font body is MBs)
            $txt = $LATIN1.GetString($ms.GetBuffer(), 0, [int]$ms.Length)
            $end = $txt.IndexOf("`r`n`r`n")
            if ($end -ge 0 -and $txt.Substring(0, $end) -match '(?im)^content-length:\s*(\d+)') { $len = [int]$Matches[1] }
        }
        if ($end -ge 0 -and $ms.Length -ge $end + 4 + $len) { break }
    }
    if ($end -lt 0) { return $null }
    $first = ($txt.Substring(0, $txt.IndexOf("`r`n")) -split ' ')
    $path = ($first[1] -split '\?')[0]
    @{ method = $first[0]; path = $path; query = (@($first[1] -split '\?', 2) + '')[1]; ms = $ms; start = $end + 4; len = $len
       body = $(if ($path -eq '/font') { '' } else { $UTF8.GetString($ms.GetBuffer(), $end + 4, $len) }) }
}
function Get-CfgJson {  # 기본값 + 설정 파일
    $d = [ordered]@{}
    foreach ($k in $DEFAULTS.Keys) { $d[$k] = $script:cfg[$k] }
    try { (Read-Json $script:CfgFile).PSObject.Properties | ForEach-Object { $d[$_.Name] = $_.Value } } catch {}
    $d
}
function Invoke-Http($r) {
    if ($r.method -eq 'OPTIONS') { return '' }
    $post = $r.method -eq 'POST'
    switch ($r.path) {
        '/now' {
            # owner (user request 2026-11-22): several player pages open → only the one whose [오버레이] turned it on last
            # (its win number); a page without win (older player) still counts
            if ($post) {
                $win = ''; try { $win = [string](($r.body | ConvertFrom-Json).win) } catch {}
                $own = [string](Get-CfgJson).owner
                if (-not $own -or -not $win -or $win -eq $own) { [IO.File]::WriteAllText($script:NowFile, $r.body, $UTF8) }
            }
            return '{"ok":true}'
        }
        '/ovset' {
            $d = Get-CfgJson
            if ($post) {
                ($r.body | ConvertFrom-Json).PSObject.Properties | Where-Object { $DEFAULTS.ContainsKey($_.Name) } | ForEach-Object { $d[$_.Name] = $_.Value }
                [IO.File]::WriteAllText($script:CfgFile, ($d | ConvertTo-Json), $UTF8)
                $script:cfgWrite = [datetime]::MinValue   # the tick re-reads it right away
            }
            return ($d | ConvertTo-Json -Compress)
        }
        '/frame' {   # ⚙ 설정 open: {on: true} every 3 s · {on: false} when it closes (구역 표시, 2026-11-20)
            if ($post) { $script:frameAt = $(if (($r.body | ConvertFrom-Json).on) { Get-Epoch } else { 0 }); Set-Frame }
            return '{"ok":true}'
        }
        '/fonts' {   # font files the player already sent (font_setting.js fontToOverlay)
            $files = @(); try { $files = @(Get-ChildItem $script:fontDir -File -ErrorAction Stop | ForEach-Object { $_.Name }) } catch {}
            return (ConvertTo-Json -InputObject @{ files = $files } -Compress)
        }
        '/font' {    # POST /font?file=<id>.<ttf|otf>, body = the raw file (sent once per file)
            $f = [Uri]::UnescapeDataString(((@($r.query -split '&') | Where-Object { $_ -like 'file=*' } | Select-Object -First 1) -replace '^file=', ''))
            if (-not $post -or $f -notmatch '^[0-9a-f]{12}\.(ttf|otf)$') { return '{"error":"bad font"}' }
            New-Item -ItemType Directory -Force $script:fontDir | Out-Null
            $fs = [IO.File]::Create((Join-Path $script:fontDir $f)); try { $fs.Write($r.ms.GetBuffer(), $r.start, $r.len) } finally { $fs.Close() }
            $script:fontCache.Remove($f); $script:cfgWrite = [datetime]::MinValue   # the tick redraws with it
            return '{"ok":true}'
        }
        '/ovprograms' {
            $items = '[]'; try { $items = [IO.File]::ReadAllText($script:ProgFile, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF) } catch {}
            if (-not $items.Trim()) { $items = '[]' }
            return '{"running":true,"ver":' + $OV_VER + ',"items":' + $items + '}'
        }
    }
    '{"error":"unknown"}'
}
function Step-Http {  # called every tick: answer whatever came in (each request is tiny and local)
    if (-not $script:http) { return }
    while ($script:http.Pending()) {
        $c = $script:http.AcceptTcpClient()
        try {
            $c.ReceiveTimeout = 2000; $c.SendTimeout = 2000
            $s = $c.GetStream()
            $r = Read-Http $s
            if ($r) { Send-Http $s (Invoke-Http $r) }
        } catch {} finally { $c.Close() }
    }
}

# 자동 업데이트, 켜져 있는 동안 (한 시간마다): a newer file starts and tells this one to quit
if (-not $Test) {
    $script:updTimer = New-Object System.Windows.Threading.DispatcherTimer
    $script:updTimer.Interval = [TimeSpan]::FromHours(1)
    $script:updTimer.Add_Tick({ [void](Update-Self) })
    $script:updTimer.Start()
}

# ---- 0.15초마다: 설정·플레이어 소식이 바뀌었는지, 지금 보일 때인지 ----
$script:lastWrite = [datetime]::MinValue
$script:now = $null
$script:tick = 0
$script:wasAlive = $false
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(150)
$timer.Add_Tick({
    $script:tick++
    Step-Http
    $redraw = $false
    if (Read-Cfg) {
        if ([double]$script:cfg.quit_at -gt $script:startedAt) { $script:app.Shutdown(); return }  # 설정 창의 '끄기'
        Set-Place; Set-MinHeight; $redraw = $true; $script:ctItem.Checked = [bool]$script:cfg.clickthrough
    }
    Set-Frame   # the 설정 window stopped saying it's open (closed tab …): the line goes after 8 s
    $ed = Test-Editing
    if ($ed -ne $script:editing) { $script:editing = $ed; $redraw = $true }
    if ($redraw) { Set-ExStyle }
    try {
        $t = [IO.File]::GetLastWriteTimeUtc($script:NowFile)
        if ($t -ne $script:lastWrite) { $script:now = Read-Json $script:NowFile; $script:lastWrite = $t; $redraw = $true }
    } catch {}  # 플레이어가 막 쓰는 중이면 다음에
    $alive = $script:now -and ((Get-Epoch) - [double]$script:now.at) -lt $STALE_MS
    if ($alive -ne $script:wasAlive) { $script:wasAlive = $alive; $redraw = $true }
    if ($redraw) { Show-Now }
    if ($script:tick % 20 -eq 1) {  # 3초마다: 붙일 프로그램이 켜져 있는지 · 프로그램 목록
        $tn = ([string]$script:cfg.target) -replace '\.exe$', ''
        $script:targetRunning = [bool]($tn -and (Get-Process -Name $tn -ErrorAction SilentlyContinue))
        $sk = Get-ScreensKey   # monitors changed (unplugged · resolution): fit the window again
        if ($sk -ne $script:screensKey) { $script:screensKey = $sk; Set-Place }
        if ($script:tick % 40 -eq 1) { Write-Programs }
    }
    $show = $Test -or $script:editing -or ($script:cfg.enabled -and (Test-ShowNow))   # enabled: 화면의 '오버레이 켜기/끄기' 
    $vis = $(if ($show) { 'Visible' } else { 'Hidden' })
    # 창째 숨김 (글자만 숨기면 보이지 않는 창이 그 자리의 마우스 클릭을 막음)
    if ($w.Visibility -ne $vis) { $w.Visibility = $vis; if ($show) { Set-ExStyle } }
    if ($show -and $script:tick % 7 -eq 0) { [OvWin]::KeepOnTop((Get-Hwnd)) }  # 게임이 맨 위를 가져가도 1초마다 다시 위로
})

# ---- 끌어 옮기기 (클릭 통과를 끈 동안 · 설정 창이 열려 있는 동안) ----
$w.Add_MouseLeftButtonDown({
    try { $w.DragMove() } catch {}
    $script:cfg.x = [int]$w.Left; $script:cfg.y = [int]$w.Top; $script:cfg.cx = [int]($w.Left + $w.ActualWidth / 2)
    if ($script:cfg.x -eq -1 -and $script:cfg.y -eq -1) { $script:cfg.x = 0 }   # -1,-1 = the reset marker (Set-Place)
    Update-CfgFile @{ x = $script:cfg.x; y = $script:cfg.y; cx = $script:cfg.cx }
    Set-Place   # dropped on another monitor: fit its width there
})
$w.Add_SourceInitialized({ Set-ExStyle })

# ---- 알림 영역 아이콘 (우클릭: 클릭 통과 · 종료 — 다른 설정은 ⚙ 가사 오버레이 설정) ----
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Information
$tray.Text = '가사 오버레이 (설정: 플레이어 ⚙)'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$script:ctItem = $menu.Items.Add('클릭 통과')
$script:ctItem.CheckOnClick = $true; $script:ctItem.Checked = [bool]$script:cfg.clickthrough
$script:ctItem.Add_Click({ $script:cfg.clickthrough = $this.Checked; Set-ExStyle; Update-CfgFile @{ clickthrough = $this.Checked } })
[void]$menu.Items.Add('-')
$quit = $menu.Items.Add('종료')
$quit.Add_Click({ $script:app.Shutdown() })
$tray.ContextMenuStrip = $menu
$tray.Visible = -not $Test

# ---- 실행 ----
$script:app = New-Object System.Windows.Application
$script:app.ShutdownMode = 'OnExplicitShutdown'
if ($Test) {  # 시험: 몇 초 뒤 그린 글자를 출력하고 끝냄
    $stop = New-Object System.Windows.Threading.DispatcherTimer
    $stop.Interval = [TimeSpan]::FromSeconds($Test)
    $stop.Add_Tick({
        "창: 투명={0} 항상위={1} 불투명도={2} 크기={3}x{4} · 설정: 글자 {5} · 테두리 {6} · 폭 {7} · 클릭 통과 {8} · 설정 중 {9} · 프로그램 '{10}'" -f $w.AllowsTransparency, $w.Topmost,
            $w.Opacity, [int]$w.ActualWidth, [int]$w.ActualHeight, $script:cfg.size, $script:cfg.outline, $script:cfg.width_pct, $script:cfg.clickthrough, $script:editing, $script:cfg.target | Write-Host
        $script:panel.Children | ForEach-Object { "[{0}칸 테두리 {1}] {2}" -f $_.Children.Count, $(($_.Children | ForEach-Object { $_.Children } | Select-Object -First 1).StrokeThickness), $_.Tag } | Write-Host
        $script:app.Shutdown()
    })
    $stop.Start()
}
$w.Show()
$timer.Start()
[void]$script:app.Run()
$tray.Visible = $false; $tray.Dispose()
if ($script:http) { $script:http.Stop() }
if ($created) { $script:mutex.ReleaseMutex() }
