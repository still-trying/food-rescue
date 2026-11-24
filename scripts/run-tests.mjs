import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'rolldown'

const outDir = resolve('.tmp-test')

try {
  await build({
    input: resolve('tests/unit.test.ts'),
    platform: 'node',
    external: [/^node:/],
    output: {
      file: resolve(outDir, 'unit.test.mjs'),
      format: 'esm',
      codeSplitting: false,
    },
  })

  const result = spawnSync(
    process.execPath,
    ['--test', resolve(outDir, 'unit.test.mjs')],
    { stdio: 'inherit' }
  )

  process.exitCode = result.status ?? 1
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

