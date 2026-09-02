-- Manual receipts may be created without an uploaded image.
ALTER TABLE "Receipt" ALTER COLUMN "imageKey" DROP NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "fileSha256" DROP NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "fileSizeBytes" DROP NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "mimeType" DROP NOT NULL;
