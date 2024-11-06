import { build, context } from 'esbuild'

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['./src/index.ts'],
  outfile: './dist/index.js',
  sourcemap: 'both',
  minify: false,
  bundle: true,
  platform: 'browser',
  target: ['es2020'],
  loader: { '.ts': 'ts' },
  define: {
    'process.env.NODE_DEBUG': 'false',
    global: 'globalThis'
  },
}

// Check command line arguments
const isWatch = process.argv.includes('--watch')
const isServe = process.argv.includes('--serve')

if (isWatch || isServe) {
  // Create a context for either watch or serve mode
  context(buildOptions).then(async (ctx) => {
    // Start watch mode if requested
    if (isWatch && !isServe) {
      await ctx.watch()
      console.log('Watching for changes...')
    }
    
    // Start serve mode if requested
    if (isServe) {
      const { host, port } = await ctx.serve({ servedir: './dist', })
      console.log(`Server running at http://${host}:${port}`)
    }
  })
} else {
  // Regular one-time build
  build(buildOptions).catch(() => process.exit(1))
}
