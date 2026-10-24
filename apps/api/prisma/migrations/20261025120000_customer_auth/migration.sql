-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK');

-- AlterTable: convert the existing varchar values to the enum without losing
-- rows. Seeded accounts stored lowercase "local".
ALTER TABLE "users" ALTER COLUMN "auth_provider" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "auth_provider" TYPE "auth_provider"
  USING (
    CASE UPPER("auth_provider")
      WHEN 'GOOGLE' THEN 'GOOGLE'::"auth_provider"
      WHEN 'FACEBOOK' THEN 'FACEBOOK'::"auth_provider"
      ELSE 'LOCAL'::"auth_provider"
    END
  );
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "ip_address" VARCHAR(45),
ADD COLUMN     "replaced_by_token_id" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_expires_at" TIMESTAMP(3),
ADD COLUMN     "email_verification_sent_at" TIMESTAMP(3),
ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" VARCHAR(255);

-- CreateIndex
CREATE INDEX "refresh_tokens_replaced_by_token_id_idx" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE INDEX "users_provider_id_idx" ON "users"("provider_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
