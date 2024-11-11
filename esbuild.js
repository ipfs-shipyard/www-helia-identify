import { build, context } from 'esbuild'

const ctx = context({
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
})

// Check command line arguments
const isWatch = process.argv.includes('--watch')
const isServe = process.argv.includes('--serve')

if (isWatch || isServe) {
  // Create a context for either watch or serve mode
  ctx.then(async (ctx) => {
    // Start serve mode if requested
    if (isServe) {
      const { host, port } = await ctx.serve({ servedir: './dist', })
      console.log(`Server running at http://${host.replace('0.0.0.0', '127.0.0.1')}:${port}`)
    } else {
      await ctx.watch()
      console.log('Watching for changes...')
    }
  })
} else {
  // Regular one-time build
  ctx.then(ctx => ctx.build()).catch((err) => {
	console.error(err)
  	process.exit(1)
  })
}
