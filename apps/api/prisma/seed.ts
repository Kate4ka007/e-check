import { hash } from '@node-rs/argon2'
import { PrismaClient } from '../src/generated/prisma'
import { ensureSystemCategories } from '../src/categories/ensure-system-categories'

const prisma = new PrismaClient()

async function main() {
  await ensureSystemCategories(prisma)
  const email = 'dev@local.test'
  const password = process.env.SEED_DEV_PASSWORD ?? 'devpassword12'

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await hash(password, {
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }),
      timezone: 'Europe/Minsk',
      locale: 'ru',
      baseCurrency: 'BYN',
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`Seeded categories and dev user ${email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
