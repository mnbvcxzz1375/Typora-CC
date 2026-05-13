$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# ── Color palette (Typora-CC graphite/green) ──────────────────
$ESC   = [char]0x1B
$RST   = "${ESC}[0m"
$BOLD  = "${ESC}[1m"
$DIM   = "${ESC}[2m"
$WHITE = "${ESC}[97m"
$GRAY  = "${ESC}[90m"
$GREEN = "${ESC}[32m"
$MINT  = "${ESC}[38;5;48m"
$TEAL  = "${ESC}[38;5;35m"
$RED   = "${ESC}[31m"
$YELLOW= "${ESC}[33m"
$ACCENT = "${ESC}[38;5;48m"

# ── Banner ────────────────────────────────────────────────────
Write-Host ''
Write-Host "  ${MINT}${BOLD}  ████████╗██╗   ██╗██████╗  ██████╗ ██████╗  █████╗       ██████╗ ██████╗${RST}"
Write-Host "  ${MINT}${BOLD}  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗     ██╔════╝██╔════╝${RST}"
Write-Host "  ${TEAL}${BOLD}     ██║    ╚████╔╝ ██████╔╝██║   ██║██████╔╝███████║     ██║     ██║     ${RST}"
Write-Host "  ${TEAL}${BOLD}     ██║     ╚██╔╝  ██╔═══╝ ██║   ██║██╔══██╗██╔══██║     ██║     ██║     ${RST}"
Write-Host "  ${GREEN}${BOLD}     ██║      ██║   ██║     ╚██████╔╝██║  ██║██║  ██║     ╚██████╗╚██████╗${RST}"
Write-Host "  ${GREEN}${BOLD}     ╚═╝      ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚═════╝${RST}"
Write-Host ''
Write-Host "  ${DIM}  $([char]0x250C)$([string]::new([char]0x2500, 50))$([char]0x2510)${RST}"
Write-Host "  ${DIM}  $([char]0x2502)${RST}  ${WHITE}Typora-CC Markdown AI Assistant${RST}                  ${DIM}$([char]0x2502)${RST}"
Write-Host "  ${DIM}  $([char]0x2502)${RST}  ${GRAY}Local tools  ${DIM}$([char]0x00B7)${RST}  ${GRAY}Skills  ${DIM}$([char]0x00B7)${RST}  ${GRAY}MCP  ${DIM}$([char]0x00B7)${RST}  ${GRAY}Multi-model${RST}       ${DIM}$([char]0x2502)${RST}"
Write-Host "  ${DIM}  $([char]0x2514)$([string]::new([char]0x2500, 50))$([char]0x2518)${RST}"
Write-Host ''
Write-Host "  ${DIM}  by ${MINT}mnbvcxzz1375${RST} ${DIM}(${RST} ${GRAY}https://github.com/mnbvcxzz1375${RST} ${DIM})${RST}"
Write-Host ''
Write-Host "  ${DIM}$([string]::new([char]0x2500, 52))${RST}"
Write-Host ''

# ── Configuration ─────────────────────────────────────────────
$typoraDir  = 'E:\Typora'
$typoraHtml = Join-Path $typoraDir 'resources\window.html'
$repoDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginSrc  = Join-Path $repoDir 'plugin'
$targetDir  = Join-Path $typoraDir 'resources\typora-gpt'
$loaderSrc  = Join-Path $repoDir 'loader-embedded.js'

try {
    if (-not (Test-Path -LiteralPath $typoraHtml)) {
        throw "Typora not found at: $typoraDir. Please edit `$typoraDir in install.ps1."
    }
    if (-not (Test-Path -LiteralPath $pluginSrc)) {
        throw "Plugin source folder not found: $pluginSrc"
    }
    if (-not (Test-Path -LiteralPath $loaderSrc)) {
        throw "Loader file not found: $loaderSrc"
    }

    # ── Step 1 ────────────────────────────────────────────────
    Write-Host "  ${ACCENT}  [1/3]${RST} ${WHITE}Copying plugin files${RST} ${DIM}...${RST}"
    if (Test-Path -LiteralPath $targetDir) {
        Remove-Item -LiteralPath $targetDir -Recurse -Force
    }

    $pluginTarget = Join-Path $targetDir 'plugin'
    $cssTarget    = Join-Path $pluginTarget 'css'
    New-Item -ItemType Directory -Path $cssTarget -Force | Out-Null

    Copy-Item -LiteralPath (Join-Path $pluginSrc 'css\style.css') -Destination $cssTarget -Force
    Get-ChildItem -LiteralPath $pluginSrc -Filter '*.js' | Copy-Item -Destination $pluginTarget -Force
    Copy-Item -LiteralPath $loaderSrc -Destination (Join-Path $targetDir 'loader.js') -Force

    if (-not (Test-Path -LiteralPath (Join-Path $targetDir 'loader.js'))) {
        throw 'Failed to copy loader.js'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $pluginTarget 'ui.js'))) {
        throw 'Failed to copy plugin files'
    }
    Write-Host "  ${GREEN}       Done${RST} ${DIM}- plugin files copied${RST}"

    # ── Step 2 ────────────────────────────────────────────────
    Write-Host "  ${ACCENT}  [2/3]${RST} ${WHITE}Backing up window.html${RST} ${DIM}...${RST}"
    $backupPath = "$typoraHtml.backup"
    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $typoraHtml -Destination $backupPath -Force
        Write-Host "  ${GREEN}       Done${RST} ${DIM}- backup created${RST}"
    } else {
        Write-Host "  ${YELLOW}       Skipped${RST} ${DIM}- backup already exists${RST}"
    }

    # ── Step 3 ────────────────────────────────────────────────
    Write-Host "  ${ACCENT}  [3/3]${RST} ${WHITE}Injecting loader into window.html${RST} ${DIM}...${RST}"
    $content = [IO.File]::ReadAllText($typoraHtml)
    $tag = "<!-- Typora-CC Plugin -->`r`n<script src=`"./typora-gpt/loader.js`"></script>`r`n"

    if ($content -match 'typora-gpt/loader\.js') {
        Write-Host "  ${YELLOW}       Skipped${RST} ${DIM}- already injected${RST}"
    } elseif ($content -match '</body>\s*</html>\s*$') {
        $content = [regex]::Replace($content, '</body>\s*</html>\s*$', $tag + '</body></html>')
        [IO.File]::WriteAllText($typoraHtml, $content, [Text.Encoding]::UTF8)
        Write-Host "  ${GREEN}       Done${RST} ${DIM}- loader injected${RST}"
    } else {
        $content = $content + "`r`n" + $tag
        [IO.File]::WriteAllText($typoraHtml, $content, [Text.Encoding]::UTF8)
        Write-Host "  ${GREEN}       Done${RST} ${DIM}- loader appended${RST}"
    }

    $updated = [IO.File]::ReadAllText($typoraHtml)
    if ($updated -notmatch 'typora-gpt/loader\.js') {
        throw 'Auto-injection failed.'
    }

    # ── Success ───────────────────────────────────────────────
    Write-Host ''
    Write-Host "  ${DIM}$([string]::new([char]0x2500, 52))${RST}"
    Write-Host ''
    Write-Host "  ${GREEN}${BOLD}  Installation Successful!${RST}"
    Write-Host ''
    Write-Host "  ${WHITE}  Next Steps:${RST}"
    Write-Host ''
    Write-Host "  ${DIM}  1.${RST} ${GRAY}Restart Typora${RST}"
    Write-Host "  ${DIM}  2.${RST} ${GRAY}Press ${WHITE}Ctrl+Shift+G${RST} ${GRAY}or click the Typora-CC button${RST}"
    Write-Host "  ${DIM}  3.${RST} ${GRAY}Click the settings icon to configure your API${RST}"
    Write-Host ''
    Write-Host "  ${DIM}$([string]::new([char]0x2500, 52))${RST}"
    Write-Host ''
    Write-Host "  ${DIM}  GitHub:${RST} ${MINT}https://github.com/mnbvcxzz1375${RST}"
    Write-Host ''
    exit 0

} catch {
    Write-Host ''
    Write-Host "  ${RED}  [x] $($_.Exception.Message)${RST}"
    Write-Host ''
    Write-Host "  ${YELLOW}  [!] Please check the Typora path and run this installer again.${RST}"
    Write-Host ''
    exit 1
}
