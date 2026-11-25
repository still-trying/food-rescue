import assert from 'node:assert/strict'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const outDir = resolve('.tmp-eval')

try {
  await build({
    input: resolve('src/utils/smartRescue.ts'),
    platform: 'node',
    external: [/^node:/],
    output: {
      file: resolve(outDir, 'smartRescue.mjs'),
      format: 'esm',
      codeSplitting: false,
    },
  })

  const mod = await import(
    pathToFileURL(resolve(outDir, 'smartRescue.mjs')).href
  )
  const dataset = JSON.parse(
    readFileSync(resolve('tests/ml-eval.json'), 'utf8')
  )

  // 1. Category classifier Macro-F1 evaluation
  const labels = Array.from(
    new Set(dataset.categoryCases.map((c) => c.expected))
  )
  let f1Sum = 0
  for (const label of labels) {
    let tp = 0
    let fp = 0
    let fn = 0
    for (const sample of dataset.categoryCases) {
      const pred = mod.suggestCategoryFromText(sample.text)
      if (pred === label && sample.expected === label) tp += 1
      else if (pred === label && sample.expected !== label) fp += 1
      else if (pred !== label && sample.expected === label) fn += 1
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall)
    f1Sum += f1
  }
  const macroF1 = f1Sum / labels.length

  // 2. Public PII guardrail recall & FPR evaluation
  let piiTp = 0
  let piiFp = 0
  let piiPos = 0
  let piiNeg = 0
  for (const sample of dataset.piiCases) {
    const detected = mod.detectPublicPiiLeak(sample.text).length > 0
    if (sample.hasPii) {
      piiPos += 1
      if (detected) piiTp += 1
    } else {
      piiNeg += 1
      if (detected) piiFp += 1
    }
  }
  const piiRecall = piiTp / piiPos
  const piiFpr = piiFp / piiNeg

  // 3. Expiry risk predictor ROC-AUC & Brier score evaluation
  const nowMs = Date.UTC(2026, 10, 25, 12, 0, 0)
  const scored = dataset.expiryRiskCases.map((item) => {
    const startMs =
      nowMs - (item.windowHours - item.hoursLeft) * 60 * 60 * 1000
    const endMs = nowMs + item.hoursLeft * 60 * 60 * 1000
    const result = mod.predictExpiryRisk(
      {
        status: 'available',
        category: item.category,
        photo_url: item.hasPhoto ? 'https://example.com/food.jpg' : null,
        quantity: item.hasQuantity ? 'Serves 5' : null,
        approx_latitude: item.hasCoords ? 26.85 : null,
        approx_longitude: item.hasCoords ? 80.95 : null,
        pickup_window_start: new Date(startMs).toISOString(),
        pickup_window_end: new Date(endMs).toISOString(),
      },
      nowMs
    )
    return { label: item.labelExpired, score: result.riskScore }
  })

  const positives = scored.filter((s) => s.label === 1)
  const negatives = scored.filter((s) => s.label === 0)
  let concordant = 0
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.score > neg.score) concordant += 1
      else if (pos.score === neg.score) concordant += 0.5
    }
  }
  const auc = concordant / (positives.length * negatives.length)
  const brier =
    scored.reduce((sum, s) => sum + (s.score - s.label) ** 2, 0) /
    scored.length

  console.log(
    JSON.stringify(
      {
        categoryMacroF1: Number(macroF1.toFixed(3)),
        piiRecall: Number(piiRecall.toFixed(3)),
        piiFalsePositiveRate: Number(piiFpr.toFixed(3)),
        expiryRiskAuc: Number(auc.toFixed(3)),
        expiryRiskBrier: Number(brier.toFixed(3)),
      },
      null,
      2
    )
  )

  assert.ok(macroF1 >= 0.85, `Category Macro-F1 below threshold: ${macroF1}`)
  assert.ok(piiRecall >= 0.95, `PII Recall below threshold: ${piiRecall}`)
  assert.ok(piiFpr <= 0.05, `PII FPR above threshold: ${piiFpr}`)
  assert.ok(auc >= 0.9, `Expiry Risk AUC below threshold: ${auc}`)
  assert.ok(brier <= 0.2, `Expiry Risk Brier score too high: ${brier}`)
} finally {
  rmSync(outDir, { recursive: true, force: true })
}

