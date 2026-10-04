-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen_release" VARCHAR(20),
ADD COLUMN     "onboarding_dismissed_at" TIMESTAMP(3);
