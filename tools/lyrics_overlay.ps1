# 가사 오버레이 — 바탕이 완전히 투명한 가사 창 (이 프로그램의 유일한 오버레이)
# 플레이어가 지금 곡·가사 묶음을 WEB\overlay\now_playing.json 에 알려 주면 (서버로 열면 바깥 틀이 서버를 통해, 서버 없이 열면 플레이어가 직접)
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

$script:Root = Split-Path -Parent $PSScriptRoot                         # WEB 폴더
$script:NowFile = if ($NowFile) { $NowFile } else { Join-Path $script:Root 'overlay\now_playing.json' }
$script:CfgFile = if ($CfgFile) { $CfgFile } else { Join-Path $script:Root 'overlay\lyrics_overlay.json' }
$script:ProgFile = Join-Path (Split-Path $script:NowFile) 'overlay_programs.json'
try { New-Item -ItemType Directory -Force (Split-Path $script:ProgFile) | Out-Null } catch {}  # WEB\overlay is not in the zip/git
$STALE_MS = 15000   # 플레이어가 5초마다 알려 줌 → 이만큼 소식이 없으면 닫힌 것으로 보고 숨김
$EDIT_MS = 8000     # 설정 창이 3초마다 '열려 있음'을 알려 줌 → 이만큼 소식이 없으면 닫힌 것으로
$UTF8 = New-Object Text.UTF8Encoding $false

# ---- 설정 (⚙ 설정 창에서 바꿈 · 위치는 끌어 옮길 때 이 창이 씀) — 서버 web_api\lyrics_overlay_files.py 와 같은 기본값 ----
$DEFAULTS = @{ x = -1; y = -1; width = 1100; size = 22; outline = 2; opacity = 100; clickthrough = $false; target = 'ffxiv_dx11'; info = $true; editing_at = 0; quit_at = 0; enabled = $true }
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

# ---- 한 번만 켜기 ----
$created = $false
$script:mutex = New-Object System.Threading.Mutex($true, 'MusicManagerLyricsOverlay', [ref]$created)
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
    Set-Item -Path "$key\shell\open\command" -Value ('"{0}" -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}" "%1"' -f $ps, $PSCommandPath)
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
$w.Content = $script:panel
$script:wa = [System.Windows.SystemParameters]::WorkArea
function Set-Place {  # 위치·폭·불투명도 (x 가 -1 이면 화면 아래 가운데 — 설정 창의 '위치 처음으로')
    $w.Width = [Math]::Max(200.0, [double]$script:cfg.width)
    $w.Opacity = [Math]::Max(0.1, [Math]::Min(1.0, [double]$script:cfg.opacity / 100.0))
    if ($Test) { $w.Left = -30000; $w.Top = -30000; return }
    if ([double]$script:cfg.x -lt 0) { $w.Left = $script:wa.Left + ($script:wa.Width - $w.Width) / 2; $w.Top = $script:wa.Bottom - 260 }
    else { $w.Left = [double]$script:cfg.x; $w.Top = [double]$script:cfg.y }
}
Set-Place

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
function New-Brush($colors) {
    $cs = @($colors | Where-Object { $_ -match '^#[0-9a-fA-F]{6}$' })
    if ($cs.Count -eq 0) { return [System.Windows.Media.Brushes]::White }
    if ($cs.Count -eq 1) { return (New-Object System.Windows.Media.BrushConverter).ConvertFromString($cs[0]) }
    $g = New-Object System.Windows.Media.LinearGradientBrush
    $g.StartPoint = '0,0'; $g.EndPoint = '0,1'
    for ($i = 0; $i -lt $cs.Count; $i++) {  # 여러 보컬(듀엣·합창): 위→아래 그라데이션 (플레이어와 같음)
        $g.GradientStops.Add((New-Object System.Windows.Media.GradientStop ([System.Windows.Media.ColorConverter]::ConvertFromString($cs[$i])), ($i / ($cs.Count - 1))))
    }
    $g
}
$script:font = New-Object System.Windows.Media.FontFamily 'Malgun Gothic'
function Add-Line($text, [double]$size, $brush, [double]$opacity, $weight) {
    $o = [Math]::Max(0.0, [double]$script:cfg.outline)
    $tf = New-Object System.Windows.Media.Typeface($script:font, [System.Windows.FontStyles]::Normal, $weight, [System.Windows.FontStretches]::Normal)
    $ft = New-Object System.Windows.Media.FormattedText($text, [Globalization.CultureInfo]::CurrentUICulture, [System.Windows.FlowDirection]::LeftToRight, $tf, $size, $brush)
    $ft.MaxTextWidth = [Math]::Max(50.0, $w.Width - 20.0 - 2.0 * $o); $ft.TextAlignment = 'Center'
    $geo = $ft.BuildGeometry((New-Object System.Windows.Point($o, $o)))
    $box = New-Object System.Windows.Controls.Grid
    $box.Width = $ft.MaxTextWidth + 2 * $o; $box.Height = $ft.Height + 2 * $o; $box.Opacity = $opacity; $box.Tag = $text
    if ($o -gt 0) {
        $edge = New-Object System.Windows.Shapes.Path
        $edge.Data = $geo; $edge.Stroke = [System.Windows.Media.Brushes]::Black; $edge.StrokeThickness = 2 * $o; $edge.StrokeLineJoin = 'Round'
        [void]$box.Children.Add($edge)
    }
    $fill = New-Object System.Windows.Shapes.Path
    $fill.Data = $geo; $fill.Fill = $brush
    [void]$box.Children.Add($fill)
    [void]$script:panel.Children.Add($box)
}
function Show-Now {
    $script:panel.Children.Clear()
    $d = $script:now
    $s = [Math]::Max(6.0, [double]$script:cfg.size)
    $white = [System.Windows.Media.Brushes]::White
    $alive = $d -and ((Get-Epoch) - [double]$d.at) -lt $STALE_MS
    if (-not $alive) {  # 재생 중인 곡이 없음: 설정 창이 열려 있을 때만 위치를 잡을 글자
        if ($script:editing) { Add-Line '가사 오버레이 — 끌어서 옮기세요' $s $white 1 ([System.Windows.FontWeights]::Bold) }
        return
    }
    if ($script:cfg.info -and $d.title) {
        Add-Line ($(if ($d.artist) { "$($d.title) — $($d.artist)" } else { $d.title })) ($s * 0.55) $white 0.9 ([System.Windows.FontWeights]::SemiBold)
    }
    $brush = New-Brush $d.colors
    foreach ($l in @($d.lines)) {
        if ($l.role -eq 'o') { Add-Line $l.text $s $brush 1 ([System.Windows.FontWeights]::Bold) }
        elseif ($l.role -eq 'r' -and $d.show_r) { Add-Line $l.text ($s * 0.65) $brush 0.85 ([System.Windows.FontWeights]::SemiBold) }
        elseif ($l.role -eq 't' -and $d.show_t) { Add-Line $l.text ($s * 0.65) $brush 1 ([System.Windows.FontWeights]::SemiBold) }
    }
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
    $redraw = $false
    if (Read-Cfg) {
        if ([double]$script:cfg.quit_at -gt $script:startedAt) { $script:app.Shutdown(); return }  # 설정 창의 '끄기'
        Set-Place; $redraw = $true; $script:ctItem.Checked = [bool]$script:cfg.clickthrough
    }
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
    $script:cfg.x = [int]$w.Left; $script:cfg.y = [int]$w.Top
    Update-CfgFile @{ x = $script:cfg.x; y = $script:cfg.y }
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
            $w.Opacity, [int]$w.ActualWidth, [int]$w.ActualHeight, $script:cfg.size, $script:cfg.outline, $script:cfg.width, $script:cfg.clickthrough, $script:editing, $script:cfg.target | Write-Host
        $script:panel.Children | ForEach-Object { "[{0}칸 테두리 {1}] {2}" -f $_.Children.Count, $(if ($_.Children.Count -gt 1) { $_.Children[0].StrokeThickness } else { 0 }), $_.Tag } | Write-Host
        $script:app.Shutdown()
    })
    $stop.Start()
}
$w.Show()
$timer.Start()
[void]$script:app.Run()
$tray.Visible = $false; $tray.Dispose()
if ($created) { $script:mutex.ReleaseMutex() }
