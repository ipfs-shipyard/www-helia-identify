import { build, context, } from 'esbuild'

/**
 * @type {import('esbuild').BuildOptions}
 */
const config = {
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
  context(config).then(async (ctx) => {
    // Start serve mode if requested
    if (isServe) {
      const { hosts, port } = await ctx.serve({ servedir: './dist', })
      console.log('Server running at')
      hosts.forEach(host => {
        console.log(`http://${host}:${port}`)
      })
    } else {
      await ctx.watch()
      console.log('Watching for changes...')
    }
  })
} else {
  // Regular one-time build
  build(config).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
