import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'rolldown'

const outDir = resolve('.tmp-test')

try {
  await build({
    input: {
      unit: resolve('tests/unit.test.ts'),
      components: resolve('tests/components.test.tsx'),
    },
    platform: 'node',
    external: [/^node:/],
    output: {
      dir: outDir,
      format: 'esm',
      entryFileNames: '[name].test.mjs',
    },
  })

  const result = spawnSync(
    process.execPath,
    [
      '--test',
      resolve(outDir, 'unit.test.mjs'),
      resolve(outDir, 'components.test.mjs'),
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_SUPABASE_URL:
          process.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY:
          process.env.VITE_SUPABASE_ANON_KEY || 'example-anon-key',
      },
    }
  )

  process.exitCode = result.status ?? 1
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
