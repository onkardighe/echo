const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
    // Bundle WebView Script
    await esbuild.build({
        entryPoints: ['src/webview/audioCall.ts'],
        bundle: true,
        outfile: 'out/webview/audioCall.js',
        platform: 'browser',
        sourcemap: true,
    });

    // Copy CSS
    const srcCss = path.join(__dirname, 'src', 'webview', 'audioCall.css');
    const destCss = path.join(__dirname, 'out', 'webview', 'audioCall.css');

    // Ensure dir exists (esbuild might have created it, but just in case)
    fs.mkdirSync(path.dirname(destCss), { recursive: true });

    fs.copyFileSync(srcCss, destCss);

    console.log('WebView resources built and copied.');
}

build().catch(() => process.exit(1));
