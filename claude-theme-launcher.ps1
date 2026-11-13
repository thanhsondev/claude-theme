# Mo Claude Desktop va tu nap Pixel Themes.
# Cach lam: bam Ctrl+Alt+I (DevTools ma app cho phep), dan script vao Console, Enter, dong DevTools.
# Chi go phim khi cua so dang focus dung la DevTools cua Claude -> khong go nham vao o chat.
param(
  [int]$LoadWait = 12,      # so giay doi giao dien load xong khi app vua duoc mo
  [switch]$NoClose,         # giu cua so DevTools lai de xem log
  [switch]$FirstRun,        # ep chay buoc "allow pasting" (tu dong lam o lan dau)
  [switch]$Random,          # doi sang 1 theme ngau nhien moi lan mo (mac dinh: giu theme da chon bang Alt+T)
  [string]$EvalFile = ''    # (go loi) dan file JS nay thay cho theme; JS goi copy(...) -> ket qua ghi ra eval-result.txt
)

$ErrorActionPreference = 'Stop'
$Aumid  = 'Claude_pzs8sxrjxfjjc!Claude'
$Script = Join-Path $PSScriptRoot 'pixel-themes-claude-desktop.js'
$Log    = Join-Path $PSScriptRoot 'launcher.log'
$Marker = Join-Path $PSScriptRoot '.da-allow-pasting'
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Add-Content -Encoding UTF8 $Log }

Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class CW {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);

  [StructLayout(LayoutKind.Sequential)] struct KBD { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit, Size = 40)] struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public KBD ki; }
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int size);

  // Go chu bang ky tu Unicode (KEYEVENTF_UNICODE) -> bo go Telex/Unikey khong bien "allow" thanh "allơ".
  public static void TypeUnicode(string s) {
    foreach (char c in s) {
      var a = new INPUT[2];
      a[0].type = 1; a[0].ki.scan = c; a[0].ki.flags = 4;
      a[1].type = 1; a[1].ki.scan = c; a[1].ki.flags = 4 | 2;
      SendInput(2, a, Marshal.SizeOf(typeof(INPUT)));
      System.Threading.Thread.Sleep(15);
    }
  }

  public static string Title(IntPtr h) { var s = new StringBuilder(512); GetWindowTextW(h, s, 512); return s.ToString(); }
  public static uint Pid(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p; }

  public static List<IntPtr> Windows(uint[] pids) {
    var set = new HashSet<uint>(pids); var r = new List<IntPtr>();
    EnumWindows((h, l) => {
      if (IsWindowVisible(h) && set.Contains(Pid(h)) && Title(h).Length > 0) r.Add(h);
      return true;
    }, IntPtr.Zero);
    return r;
  }

  [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int pid);
  [DllImport("user32.dll")] static extern bool SystemParametersInfoW(uint a, uint b, IntPtr c, uint d);

  // Dua cua so len truoc ma khong bam Alt (Alt se bat thanh menu an cua app).
  // Windows chi cho doi foreground neu tien trinh "vua co input" -> co 3 cach, thu lan luot.
  public static bool Focus(IntPtr h, int how) {
    if (h == IntPtr.Zero) return false;
    if (IsIconic(h)) ShowWindow(h, 9);
    if (how == 1) {
      // Gia 1 phim khong ton tai (VK 0xFC = VK_NONAME): Windows coi nhu minh vua co input, app nao cung bo qua phim nay.
      var a = new INPUT[2];
      a[0].type = 1; a[0].ki.vk = 0xFC;
      a[1].type = 1; a[1].ki.vk = 0xFC; a[1].ki.flags = 2;
      SendInput(2, a, Marshal.SizeOf(typeof(INPUT)));
    } else if (how == 2) {
      ShowWindow(h, 6);   // minimize
      System.Threading.Thread.Sleep(250);
      ShowWindow(h, 9);   // restore -> Windows kich hoat lai cua so
    }
    uint dummy;
    uint fg = GetWindowThreadProcessId(GetForegroundWindow(), out dummy);
    uint me = GetCurrentThreadId();
    bool att = fg != 0 && fg != me && AttachThreadInput(me, fg, true);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    if (att) AttachThreadInput(me, fg, false);
    System.Threading.Thread.Sleep(300);
    return GetForegroundWindow() == h;
  }
  public static void Focus(IntPtr h) { Focus(h, 0); }
}
'@

function ClaudePids {
  @(Get-Process claude -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like '*\WindowsApps\Claude_*' } |
    ForEach-Object { [uint32]$_.Id })
}
function ClaudeWindows { $p = ClaudePids; if ($p) { [CW]::Windows($p) } }
function MainWindow {
  $w = @(ClaudeWindows)
  $m = $w | Where-Object { [CW]::Title($_) -eq 'Claude' } | Select-Object -First 1
  if (-not $m) { $m = $w | Where-Object { [CW]::Title($_) -like '*Claude*' -and [CW]::Title($_) -notmatch '^(DevTools|Developer Tools)' } | Select-Object -First 1 }
  $m
}
function DevToolsWindow { ClaudeWindows | Where-Object { [CW]::Title($_) -match '^(DevTools|Developer Tools)' } | Select-Object -First 1 }
function WaitFor([scriptblock]$cond, [int]$sec) {
  $end = (Get-Date).AddSeconds($sec)
  while ((Get-Date) -lt $end) { $v = & $cond; if ($v) { return $v }; Start-Sleep -Milliseconds 250 }
  return $null
}
function FgIsDevTools {
  $f = [CW]::GetForegroundWindow()
  ($f -ne [IntPtr]::Zero) -and ((ClaudePids) -contains [CW]::Pid($f)) -and ([CW]::Title($f) -match '^(DevTools|Developer Tools)')
}
function Keys($k) { [System.Windows.Forms.SendKeys]::SendWait($k) }
function FgInfo { $f = [CW]::GetForegroundWindow(); "foreground='$([CW]::Title($f))' pid=$([CW]::Pid($f))" }
# Thu dua cua so len truoc trong ~10s, lan luot 3 cach; tra ve true neu duoc.
function FocusHard($h) {
  for ($i = 0; $i -lt 12; $i++) {
    if ([CW]::Focus($h, $i % 3)) { if ($i -gt 0) { Log "focus duoc o lan thu $($i + 1) (cach $($i % 3))" }; return $true }
    Start-Sleep -Milliseconds 500
  }
  Log "khong dua duoc cua so len truoc sau 12 lan: $(FgInfo)"
  return $false
}

Log '--- start'
if (-not (Test-Path $Script)) { Log "khong thay $Script"; exit 1 }
if (-not (Test-Path $Marker)) { $FirstRun = $true }

# 1. Mo app (neu dang chay thi chi dua len truoc)
$main = MainWindow
if (-not $main) {
  Log 'mo Claude'
  Start-Process "shell:AppsFolder\$Aumid"
  $main = WaitFor { MainWindow } 90
  if (-not $main) { Log 'het 90s van chua thay cua so Claude'; exit 1 }
  Start-Sleep -Seconds $LoadWait
  $main = WaitFor { MainWindow } 10
  if (-not $main) { Log 'cua so Claude bien mat sau khi load'; exit 1 }
}
Log "cua so chinh: $main '$([CW]::Title($main))'"

# 2. Mo DevTools (neu chua mo)
$dt = DevToolsWindow
$openedDt = -not $dt
if (-not $dt) {
  if (-not (FocusHard $main)) { exit 2 }
  Start-Sleep -Milliseconds 300
  Keys '^%i'
  $dt = WaitFor { DevToolsWindow } 10
  if (-not $dt) { Log 'Ctrl+Alt+I khong mo duoc DevTools (chua bat allowDevTools, hoac chua khoi dong lai app sau khi bat)'; exit 2 }
  Start-Sleep -Seconds 2   # DevTools load giao dien
}

# 3. Chuyen sang Console, dan script, Enter -- chi go khi foreground dung la DevTools
$old = $null
try { if ([System.Windows.Forms.Clipboard]::ContainsText()) { $old = [System.Windows.Forms.Clipboard]::GetText() } } catch {}
if ($EvalFile) { $code = [IO.File]::ReadAllText($EvalFile, [Text.Encoding]::UTF8) } else {
$code = [IO.File]::ReadAllText($Script, [Text.Encoding]::UTF8)
# Ghep theme tu lam (custom-themes.js) vao truoc dong chot danh sach theme.
$Custom = Join-Path $PSScriptRoot 'custom-themes.js'
$Anchor = 'const ITEMS = THEMES.map('
if (Test-Path $Custom) {
  $at = $code.IndexOf($Anchor)
  if ($at -ge 0) {
    # Am thanh that (sounds\*.ogg) nhung thanh base64: const PXT_SOUNDS = { ho1: '...', chuong1: '...' };
    $snd = @()
    $SndDir = Join-Path $PSScriptRoot 'sounds'
    if (Test-Path $SndDir) {
      foreach ($f in Get-ChildItem $SndDir -Filter *.ogg -File) {
        $snd += "$($f.BaseName): '$([Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName)))'"
      }
    }
    $sndJs = "const PXT_SOUNDS = { $($snd -join ', ') };`n  "
    $code = $code.Insert($at, $sndJs + [IO.File]::ReadAllText($Custom, [Text.Encoding]::UTF8) + "`n  ")
  }
  else { Log "khong thay '$Anchor' trong script (ban moi doi cau truc?) -> bo qua custom-themes.js" }
}
if ($Random) {
  # Doi sang 1 theme ngau nhien (khac theme hien tai). Neu dang chon "Tat" thi de nguyen.
  $code += @'

;(() => {
  const p = window.__pixelThemes;
  if (!p || p.current === 'off') return;
  const list = p.themes.filter((t) => t !== 'off' && t !== p.current);
  if (list.length) { const id = list[Math.floor(Math.random() * list.length)]; p.set(id); console.info('Pixel Themes: random -> ' + id); }
})();
'@
}
}
[System.Windows.Forms.Clipboard]::SetText($code)

$ok = $false
for ($i = 0; $i -lt 3 -and -not $ok; $i++) {
  [CW]::Focus($dt); Start-Sleep -Milliseconds 500
  if (-not (FgIsDevTools)) { continue }
  # Ctrl+` = hien Console va dat con tro vao o nhap. Khong go chu (bo go Telex se lam hong chu).
  Keys '^`'; Start-Sleep -Milliseconds 900
  if (-not (FgIsDevTools)) { continue }
  if ($FirstRun) {
    # Lan dau Console chan dan. Dan thu -> (bi chan thi o trong, khong bi chan thi co script) -> xoa o
    # -> go "allow pasting" Enter (neu khong can thi chi la 1 dong loi vo hai) -> roi moi dan that.
    Keys '^v'; Start-Sleep -Seconds 2
    if (-not (FgIsDevTools)) { continue }
    Keys '^a'; Keys '{DEL}'; Start-Sleep -Milliseconds 300
    [CW]::TypeUnicode('allow pasting'); Start-Sleep -Milliseconds 300
    Keys '{ENTER}'; Start-Sleep -Seconds 1
    if (-not (FgIsDevTools)) { continue }
  }
  Keys '^a'; Keys '{DEL}'; Start-Sleep -Milliseconds 300   # xoa o nhap Console cho sach
  Keys '^v'; Start-Sleep -Seconds 2
  if (-not (FgIsDevTools)) { continue }
  Keys '{ENTER}'; Start-Sleep -Seconds 2
  $ok = $true
}

if ($EvalFile -and $ok) {
  $res = ''; try { $res = [System.Windows.Forms.Clipboard]::GetText() } catch {}
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'eval-result.txt'), $res, (New-Object Text.UTF8Encoding $false))
}
if ($old) { try { [System.Windows.Forms.Clipboard]::SetText($old) } catch {} } else { try { [System.Windows.Forms.Clipboard]::Clear() } catch {} }

if (-not $ok) {
  Log 'khong giu duoc focus o DevTools (dang dung cua so khac?) -> dung, khong go gi them'
  if ($openedDt -and -not $NoClose) { [void][CW]::PostMessageW($dt, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) }
  exit 3
}
if ($FirstRun) { Set-Content -Path $Marker -Value (Get-Date) }
Log 'da dan script'

# 4. Dong DevTools, tra focus ve app
if (-not $NoClose) {
  [void][CW]::PostMessageW($dt, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)   # WM_CLOSE
  Start-Sleep -Milliseconds 500
  $m = MainWindow; if ($m) { [CW]::Focus($m) }
}
Log 'xong'
