<script setup lang="ts">
import type { ReceiptProcessingResponse } from '@receipt-tracker/contracts'
import type { ApiClientError } from '~/composables/useApi'
import { messageKeyForError } from '~/utils/apiErrors'

const { t } = useT()
const api = useApi()
const { pollUntilDone, stageLabel, statusLabel } = useReceiptProcessing()

const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const manualEntry = ref(false)
const uploading = ref(false)
const creatingManual = ref(false)
const processing = ref(false)
const processingStatus = ref<ReceiptProcessingResponse | null>(null)
const errorMessage = ref<string | null>(null)
const successReceiptId = ref<string | null>(null)
const retrying = ref(false)

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  setFile(selected)
}

function setFile(selected: File) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
  errorMessage.value = null
  successReceiptId.value = null
  processingStatus.value = null
}

async function resizeImage(source: File, maxSide = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      0.85,
    )
  })
}

async function waitForProcessing(receiptId: string) {
  processing.value = true
  try {
    const result = await pollUntilDone(receiptId)
    processingStatus.value = result

    if (result.processingStatus === 'FAILED') {
      return
    }

    if (result.processingStatus === 'COMPLETED') {
      await navigateTo(`/receipts/${receiptId}`)
    }
  } catch {
    errorMessage.value = t('processing.timeout')
  } finally {
    processing.value = false
  }
}

async function retryProcessing() {
  if (!successReceiptId.value || retrying.value || processing.value) return

  retrying.value = true
  errorMessage.value = null

  try {
    await api.reprocessReceipt(successReceiptId.value)
    await waitForProcessing(successReceiptId.value)
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('upload.error.internal')
  } finally {
    retrying.value = false
  }
}

async function createWithoutPhoto() {
  if (creatingManual.value || uploading.value || processing.value) return

  creatingManual.value = true
  errorMessage.value = null

  try {
    const payload = new FormData()
    payload.append('entryMode', 'MANUAL')
    const result = await api.uploadReceipt(payload, crypto.randomUUID())
    await navigateTo(`/receipts/${result.receiptId}`)
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('upload.error.internal')
  } finally {
    creatingManual.value = false
  }
}

async function upload() {
  if (!file.value || uploading.value || processing.value) return

  uploading.value = true
  errorMessage.value = null
  processingStatus.value = null

  try {
    const blob = await resizeImage(file.value)
    const payload = new FormData()
    payload.append('file', blob, 'receipt.jpg')
    if (manualEntry.value) {
      payload.append('entryMode', 'MANUAL')
    }

    const result = await api.uploadReceipt(payload, crypto.randomUUID())
    successReceiptId.value = result.receiptId

    if (!manualEntry.value && result.processingStatus !== 'SKIPPED') {
      await waitForProcessing(result.receiptId)
    } else {
      await navigateTo(`/receipts/${result.receiptId}`)
    }
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('upload.error.internal')
    successReceiptId.value = null
  } finally {
    uploading.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <div class="mx-auto w-full max-w-lg px-4 py-6">
    <h1 class="mb-2 text-lg font-semibold text-(--ui-text-highlighted) sm:text-xl">
      {{ t('upload.title') }}
    </h1>
    <p class="mb-6 text-sm text-(--ui-text-muted)">
      {{ t('upload.subtitle') }}
    </p>

    <UAlert
      v-if="processing || processingStatus"
      class="mb-4"
      :color="processingStatus?.processingStatus === 'FAILED' ? 'warning' : 'info'"
      variant="soft"
      :icon="processing ? 'i-lucide-loader-circle' : 'i-lucide-scan-text'"
      :title="
        processingStatus
          ? statusLabel(processingStatus.processingStatus)
          : t('processing.PROCESSING')
      "
      :description="
        processing
          ? (stageLabel(processingStatus?.stage ?? 'EXTRACTING') ?? t('processing.PROCESSING'))
          : processingStatus?.processingStatus === 'COMPLETED'
            ? t('upload.processingDone')
            : t('processing.failedHint')
      "
    />

    <UAlert
      v-else-if="successReceiptId && manualEntry"
      class="mb-4"
      color="success"
      variant="soft"
      icon="i-lucide-check"
      :title="t('upload.success.title')"
      :description="t('upload.success.description')"
    />

    <UAlert
      v-if="errorMessage"
      class="mb-4"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="errorMessage"
    />

    <div v-if="!successReceiptId" class="space-y-4">
      <div
        class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-(--ui-border) p-6"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt=""
          class="max-h-64 w-full rounded object-contain"
        />
        <UIcon v-else name="i-lucide-image-plus" class="size-10 text-(--ui-text-dimmed)" />

        <div class="flex flex-wrap justify-center gap-2">
          <label class="inline-flex cursor-pointer">
            <input type="file" accept="image/*" class="sr-only" @change="onFileSelected" />
            <UButton as="span" color="primary" variant="soft" icon="i-lucide-upload">
              {{ t('upload.pickFile') }}
            </UButton>
          </label>

          <label class="inline-flex cursor-pointer sm:hidden">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="sr-only"
              @change="onFileSelected"
            />
            <UButton as="span" color="neutral" variant="soft" icon="i-lucide-camera">
              {{ t('upload.camera') }}
            </UButton>
          </label>
        </div>
      </div>

      <UCheckbox v-model="manualEntry" :label="t('upload.manualEntry')" />

      <UButton
        block
        color="primary"
        :disabled="!file || uploading || processing || creatingManual"
        :loading="uploading || processing"
        icon="i-lucide-send"
        @click="upload"
      >
        {{
          uploading
            ? t('upload.uploading')
            : processing
              ? t('processing.PROCESSING')
              : t('upload.action')
        }}
      </UButton>

      <div class="relative py-2">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-(--ui-border)" />
        </div>
        <div class="relative flex justify-center">
          <span class="bg-(--ui-bg) px-2 text-xs text-(--ui-text-dimmed)">{{
            t('upload.or')
          }}</span>
        </div>
      </div>

      <UButton
        block
        color="neutral"
        variant="soft"
        icon="i-lucide-pencil-line"
        :loading="creatingManual"
        :disabled="uploading || processing || creatingManual"
        @click="createWithoutPhoto"
      >
        {{ t('upload.createWithoutPhoto') }}
      </UButton>
    </div>

    <div v-else class="flex flex-wrap gap-2">
      <UButton
        v-if="processingStatus?.processingStatus === 'FAILED'"
        color="primary"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="retrying || processing"
        :disabled="retrying || processing"
        @click="retryProcessing"
      >
        {{ t('processing.retry') }}
      </UButton>
      <UButton
        v-if="processingStatus?.processingStatus !== 'COMPLETED'"
        :to="`/receipts/${successReceiptId}`"
        color="neutral"
        variant="soft"
        icon="i-lucide-pencil"
      >
        {{ t('upload.openReceipt') }}
      </UButton>
      <UButton
        v-if="processingStatus?.processingStatus === 'COMPLETED'"
        :to="`/receipts/${successReceiptId}`"
        color="primary"
        variant="soft"
      >
        {{ t('upload.openReceipt') }}
      </UButton>
      <UButton to="/receipts" color="neutral" variant="soft">
        {{ t('upload.backToList') }}
      </UButton>
    </div>
  </div>
</template>
