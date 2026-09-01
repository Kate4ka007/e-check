import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const receiptImage = join(import.meta.dirname, 'fixtures', 'receipt.jpg')

test('register, upload receipt, review, confirm, see in list', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.com`
  const password = 'E2ePassword1!'

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Чеки' })).toBeVisible()

  await page.goto('/receipts/new')
  await page.locator('input[type="file"]').first().setInputFiles(receiptImage)
  await page.getByRole('button', { name: 'Загрузить' }).click()

  await page.waitForURL(/\/receipts\/[0-9a-f-]+$/, { timeout: 90_000 })

  await expect(page.getByPlaceholder('Название как на чеке')).toHaveValue('Mock Store')

  const firstItemName = page.getByRole('textbox', { name: 'Новая позиция' }).first()
  await expect(firstItemName).toHaveValue('Хлеб белый')
  await firstItemName.fill('Хлеб черный')

  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('button', { name: 'Сохранено' })).toBeVisible()

  await page.getByRole('button', { name: 'Подтвердить' }).click()
  await expect(page.getByText('Подтверждён')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Mock Store/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Mock Store/ })).toContainText(/5[,.]70/)
})
