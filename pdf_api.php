<?php
/**
 * pdf_api.php  —  Sudhir Nama PDF Generator
 * Upload this file to your public_html folder on freemiumhosting.
 * That's it. No other files needed.
 *
 * How it works:
 *   1. Your Blogger button sends the post HTML + title via POST.
 *   2. This script wraps it in a full page with your CSS, header & footer.
 *   3. Dompdf converts it to a real vector PDF (sharp text at any zoom).
 *   4. The PDF is streamed back to the browser for download.
 *
 * Dompdf is auto-installed on first run using PHP's built-in zip support.
 * No Composer, no SSH, no terminal needed.
 */

// ============================================================
//   SETTINGS — edit these freely
// ============================================================
define('SITE_NAME',    'Sudhir Nama');
define('SITE_URL',     'sudhirnama.in');
define('HEADER_COLOR', '#007e65');   // green header/footer background
define('ACCENT_COLOR', '#00c49a');   // lighter accent stripe
define('TEXT_LIGHT',   '#b2f0e0');   // light text in header/footer
define('ALLOWED_ORIGIN', 'https://www.sudhirnama.in'); // your Blogger URL
// ============================================================


// ── CORS — only allow requests from your Blogger blog ──────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Allow both www and non-www versions
if (in_array($origin, [
    'https://www.sudhirnama.in',
    'https://sudhirnama.in',
    'http://www.sudhirnama.in',
    'http://sudhirnama.in',
])) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://www.sudhirnama.in');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST required']);
    exit;
}

// ── Read incoming JSON ──────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);
$postHtml  = $input['html']  ?? '';
$postTitle = $input['title'] ?? 'Post';

if (empty($postHtml)) {
    http_response_code(400);
    echo json_encode(['error' => 'No HTML received']);
    exit;
}

// Sanitise title for filename
$filename = preg_replace('/[^a-z0-9_\-]/i', '_', $postTitle) . '.pdf';

// ── Auto-install Dompdf if not present ─────────────────────
$dompdfDir  = __DIR__ . '/dompdf_lib';
$autoload   = $dompdfDir . '/vendor/autoload.php';

if (!file_exists($autoload)) {
    installDompdf($dompdfDir);
}

if (!file_exists($autoload)) {
    http_response_code(500);
    echo json_encode(['error' => 'Dompdf could not be installed. Check server write permissions.']);
    exit;
}

require_once $autoload;

use Dompdf\Dompdf;
use Dompdf\Options;

// ── Build the full HTML document ────────────────────────────
$fullHtml = buildHtml($postTitle, $postHtml);

// ── Render PDF with Dompdf ──────────────────────────────────
$options = new Options();
$options->set('isRemoteEnabled', true);      // allows loading images from URLs
$options->set('isHtml5ParserEnabled', true); // better HTML5 support
$options->set('defaultFont', 'DejaVu Sans'); // Unicode font — handles all special chars
$options->set('dpi', 150);

$dompdf = new Dompdf($options);
$dompdf->loadHtml($fullHtml, 'UTF-8');
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

// Add page numbers via canvas script
$canvas = $dompdf->getCanvas();
$font   = $dompdf->getFontMetrics()->getFont('DejaVu Sans', 'normal');
$total  = $canvas->get_page_count();

$canvas->page_script(function($pageNumber, $pageCount, $canvas, $fontMetrics) {
    $font     = $fontMetrics->getFont('DejaVu Sans', 'normal');
    $pageW    = $canvas->get_width();   // points
    $pageH    = $canvas->get_height();
    $fontSize = 8;

    // Footer background (drawn on every page by the HTML, but page number is dynamic)
    $text = 'Page ' . $pageNumber . ' of ' . $pageCount;
    $tw   = $fontMetrics->getTextWidth($text, $font, $fontSize);

    // Right-aligned page number inside footer (28pt from bottom, 20pt from right)
    $canvas->text($pageW - 55 - $tw, $pageH - 25, $text, $font, $fontSize, [1, 1, 1]);
});

// Stream the PDF to browser
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: private, max-age=0, must-revalidate');
echo $dompdf->output();
exit;


// ============================================================
//   Build the full HTML document
// ============================================================
function buildHtml(string $title, string $body): string
{
    $siteName = SITE_NAME;
    $siteUrl  = SITE_URL;
    $hColor   = HEADER_COLOR;
    $aColor   = ACCENT_COLOR;
    $tLight   = TEXT_LIGHT;

    // Escape title for safe HTML output
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>

/* ── Reset ── */
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Page setup ── */
@page {
    size: A4 portrait;
    margin: 0;   /* we control all spacing ourselves */
}

body {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
}

/* ── Header (fixed at top of every page) ── */
#pdf-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 38pt;
    background: {$hColor};
    padding: 0 16pt;
    display: flex;           /* note: Dompdf has limited flex support */
}
#pdf-header .accent-bar {
    position: absolute;
    top: 0; left: 0;
    width: 6pt; height: 38pt;
    background: {$aColor};
}
#pdf-header .site-name {
    position: absolute;
    left: 20pt;
    top: 10pt;
    font-size: 14pt;
    font-weight: bold;
    color: #ffffff;
    font-family: 'DejaVu Sans', sans-serif;
}
#pdf-header .site-url {
    position: absolute;
    right: 16pt;
    top: 13pt;
    font-size: 8pt;
    color: {$tLight};
    font-family: 'DejaVu Sans', sans-serif;
}
#pdf-header .divider {
    position: absolute;
    bottom: 0; left: 16pt; right: 16pt;
    height: 1pt;
    background: {$aColor};
}

/* ── Footer (fixed at bottom of every page) ── */
#pdf-footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 28pt;
    background: {$hColor};
}
#pdf-footer .accent-bar {
    position: absolute;
    top: 0; left: 0;
    width: 6pt; height: 28pt;
    background: {$aColor};
}
#pdf-footer .footer-site {
    position: absolute;
    left: 20pt;
    top: 8pt;
    font-size: 8pt;
    font-weight: bold;
    color: #ffffff;
    font-family: 'DejaVu Sans', sans-serif;
}
#pdf-footer .divider {
    position: absolute;
    top: 0; left: 16pt; right: 16pt;
    height: 1pt;
    background: {$aColor};
}

/* ── Main content area ── */
#content {
    margin-top: 48pt;     /* below header */
    margin-bottom: 38pt;  /* above footer */
    margin-left: 28pt;
    margin-right: 28pt;
    padding-top: 8pt;
}

/* ── Post title ── */
#post-title {
    font-size: 18pt;
    font-weight: bold;
    color: #0d3d30;
    margin-bottom: 6pt;
    line-height: 1.3;
    font-family: 'DejaVu Sans', sans-serif;
}

/* ── Title divider ── */
#title-divider {
    height: 2pt;
    background: {$hColor};
    margin-bottom: 14pt;
    border-radius: 1pt;
}

/* ── Typography — matches most Blogger themes ── */
p {
    margin-bottom: 9pt;
    text-align: justify;
}

h1, h2, h3, h4, h5, h6 {
    color: #005244;
    font-family: 'DejaVu Sans', sans-serif;
    font-weight: bold;
    margin-top: 14pt;
    margin-bottom: 6pt;
    line-height: 1.3;
}
h1 { font-size: 16pt; }
h2 { font-size: 14pt; }
h3 { font-size: 13pt; }
h4 { font-size: 12pt; }
h5, h6 { font-size: 11pt; }

/* ── Lists ── */
ul, ol {
    margin-left: 18pt;
    margin-bottom: 9pt;
}
li { margin-bottom: 3pt; }

/* ── Images ── */
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10pt auto;
}

/* ── Tables ── */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
    font-size: 10pt;
}
th {
    background: {$hColor};
    color: #ffffff;
    padding: 5pt 7pt;
    text-align: left;
    font-weight: bold;
}
td {
    padding: 4pt 7pt;
    border-bottom: 0.5pt solid #d0e8e3;
}
tr:nth-child(even) td { background: #f0faf7; }

/* ── Code blocks ── */
pre, code {
    font-family: 'DejaVu Sans Mono', monospace;
    font-size: 9pt;
    background: #f0faf7;
    border-left: 3pt solid {$hColor};
    padding: 6pt 10pt;
    margin-bottom: 10pt;
    white-space: pre-wrap;
    word-wrap: break-word;
}

/* ── Blockquotes ── */
blockquote {
    border-left: 4pt solid {$hColor};
    background: #edf7f4;
    padding: 6pt 12pt;
    margin: 10pt 0;
    color: #333;
    font-style: italic;
}

/* ── Links ── */
a { color: #007e65; text-decoration: none; }

/* ── Subscript / Superscript ── */
sub { font-size: 7pt; vertical-align: sub; }
sup { font-size: 7pt; vertical-align: super; }

/* ── Strong / Em ── */
strong, b { font-weight: bold; color: #0d3d30; }
em, i { font-style: italic; }

/* ── Mark / Highlight ── */
mark { background: #fff176; padding: 0 2pt; }

/* ── Hide things that shouldn't appear in PDF ── */
.pdf-hide, button, .share-buttons, .comments, #comments,
.related-posts, .post-footer, nav, .navbar, .sidebar,
script, style, iframe { display: none !important; }

</style>
</head>
<body>

<!-- Fixed Header (appears on every page) -->
<div id="pdf-header">
    <div class="accent-bar"></div>
    <div class="site-name">{$siteName}</div>
    <div class="site-url">{$siteUrl}</div>
    <div class="divider"></div>
</div>

<!-- Fixed Footer (appears on every page) -->
<div id="pdf-footer">
    <div class="accent-bar"></div>
    <div class="divider"></div>
    <div class="footer-site">{$siteUrl}</div>
    <!-- Page numbers are injected by Dompdf canvas script -->
</div>

<!-- Main Content -->
<div id="content">
    <div id="post-title">{$safeTitle}</div>
    <div id="title-divider"></div>
    {$body}
</div>

</body>
</html>
HTML;
}


// ============================================================
//   Auto-install Dompdf (no Composer / SSH needed)
//   Downloads the pre-built zip from GitHub releases.
// ============================================================
function installDompdf(string $targetDir): void
{
    // Dompdf 2.0.4 — pre-built release zip (includes all dependencies)
    $zipUrl  = 'https://github.com/dompdf/dompdf/releases/download/v2.0.4/dompdf_2-0-4.zip';
    $zipFile = sys_get_temp_dir() . '/dompdf.zip';

    // Download
    $zip = file_get_contents($zipUrl);
    if ($zip === false) {
        // Try with cURL as fallback
        $ch = curl_init($zipUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        $zip = curl_exec($ch);
        curl_close($ch);
    }

    if (empty($zip)) return;

    file_put_contents($zipFile, $zip);

    // Extract
    if (!is_dir($targetDir)) mkdir($targetDir, 0755, true);

    $za = new ZipArchive();
    if ($za->open($zipFile) === true) {
        $za->extractTo($targetDir);
        $za->close();
    }

    unlink($zipFile);

    // The zip extracts into a subfolder — find the autoload.php
    // and move everything up one level if needed
    $autoload = $targetDir . '/vendor/autoload.php';
    if (!file_exists($autoload)) {
        // Look one level deeper
        $dirs = glob($targetDir . '/*/vendor/autoload.php');
        if (!empty($dirs)) {
            $subDir = dirname(dirname($dirs[0]));
            // Move contents up
            $items = array_diff(scandir($subDir), ['.', '..']);
            foreach ($items as $item) {
                rename($subDir . '/' . $item, $targetDir . '/' . $item);
            }
            rmdir($subDir);
        }
    }
}
