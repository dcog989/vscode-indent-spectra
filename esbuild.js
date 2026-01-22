const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'info',
        treeShaking: true,
        metafile: production,
        legalComments: 'none',
        target: ['node22'],
        define: {
            'process.env.NODE_ENV': production ? '"production"' : '"development"',
        },
    });

    if (watch) {
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await ctx.rebuild();

        if (production && ctx.metafile) {
            const text = await esbuild.analyzeMetafile(ctx.metafile, {
                verbose: false,
            });
            console.log(text);
        }

        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
