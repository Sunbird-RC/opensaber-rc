-- CreateEnum
CREATE TYPE "BlockchainStatus" AS ENUM ('PENDING', 'ANCHORED', 'FAILED');

-- AlterTable
ALTER TABLE "VerifiableCredentialSchema" ADD COLUMN     "blockchainStatus" "BlockchainStatus";
