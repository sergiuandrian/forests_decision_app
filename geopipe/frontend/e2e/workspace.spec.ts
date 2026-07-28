import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const samplePath = path.join(root, 'sample-data', 'paris-sites.geojson')

test.describe('GeoPipe workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('brand')).toBeVisible()
    await expect(page.getByTestId('map-canvas')).toBeVisible()
  })

  test('shows branded map-first shell and workspace tabs', async ({ page }) => {
    await expect(page.getByTestId('brand')).toHaveText('GeoPipe')
    await expect(page.getByTestId('publish-bar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Layers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'API' })).toBeVisible()
  })

  test('publishes a sample layer and frames it on the map', async ({ page }) => {
    await page.getByTestId('upload-input').setInputFiles(samplePath)

    const layerButton = page.getByTestId('layer-list').getByRole('button').filter({ hasText: 'paris-sites' })
    await expect(layerButton.first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('layer-detail')).toBeVisible()
    await expect(page.getByTestId('layer-detail')).toContainText(/Point|Polygon|Mixed/i)
    await expect(page.getByTestId('empty-state')).toHaveCount(0)
  })

  test('exposes connector endpoints and backend status', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect' }).click()
    await expect(page.getByTestId('connect-panel')).toBeVisible()
    await expect(page.getByTestId('connect-panel')).toContainText('MCP HTTP tools')

    await page.getByRole('button', { name: 'API' }).click()
    await expect(page.getByTestId('api-panel')).toBeVisible()
    await expect(page.getByTestId('backend-list')).toContainText('geopackage')
    await expect(page.getByTestId('backend-list')).toContainText('duckdb')
  })
})
