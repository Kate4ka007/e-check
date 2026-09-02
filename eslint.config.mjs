import { createConfigForNuxt } from '@nuxt/eslint-config'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import { globalIgnores } from 'eslint/config'

const webRoot = 'apps/web'

export default createConfigForNuxt({
  features: {
    // Форматирование — Prettier (через eslint-plugin-prettier), не @stylistic.
    stylistic: false,
  },
  dirs: {
    root: [webRoot],
    src: [`${webRoot}/app`],
    pages: [`${webRoot}/app/pages`],
    layouts: [`${webRoot}/app/layouts`],
    components: [`${webRoot}/app/components`],
    composables: [`${webRoot}/app/composables`],
    plugins: [`${webRoot}/app/plugins`],
    middleware: [`${webRoot}/app/middleware`],
  },
})
  .prepend(
    globalIgnores([
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/.nitro/**',
      '**/coverage/**',
      '**/.docker-data/**',
      'apps/api/src/generated/**',
      'apps/api/dist/**',
      'apps/api/prisma/**',
      'packages/contracts/dist/**',
      'packages/contracts/src/**/*.js',
      'packages/contracts/src/**/*.d.ts',
      'packages/contracts/src/**/*.js.map',
      'spike/**',
      'apps/api/vitest.config.ts',
      'apps/api/vitest.integration.config.ts',
      'apps/web/public/.local/**',
      'test-results/**',
      'playwright-report/**',
      'pnpm-lock.yaml',
    ]),
  )
  .append(
    {
      files: ['apps/api/**/*.ts', 'packages/contracts/src/**/*.ts', 'e2e/**/*.ts'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/no-dynamic-delete': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    {
      files: ['apps/web/**/*.vue', 'apps/web/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-dynamic-delete': 'off',
        'vue/require-default-prop': 'off',
      },
    },
    {
      files: ['packages/contracts/src/**/*.ts'],
      rules: {
        'no-useless-escape': 'off',
      },
    },
    eslintPluginPrettierRecommended,
  )
