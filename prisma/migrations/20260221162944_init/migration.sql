-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "transactionHash" VARCHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "topics" TEXT[],
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erc20_transfers" (
    "id" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "transactionHash" VARCHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "from" VARCHAR(42) NOT NULL,
    "to" VARCHAR(42) NOT NULL,
    "value" TEXT NOT NULL,
    "tokenAddress" VARCHAR(42) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erc20_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swaps" (
    "id" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "transactionHash" VARCHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "poolAddress" VARCHAR(42) NOT NULL,
    "sender" VARCHAR(42) NOT NULL,
    "recipient" VARCHAR(42) NOT NULL,
    "amount0In" TEXT NOT NULL,
    "amount1In" TEXT NOT NULL,
    "amount0Out" TEXT NOT NULL,
    "amount1Out" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_logs_blockNumber_idx" ON "event_logs"("blockNumber");

-- CreateIndex
CREATE INDEX "event_logs_transactionHash_idx" ON "event_logs"("transactionHash");

-- CreateIndex
CREATE INDEX "event_logs_address_idx" ON "event_logs"("address");

-- CreateIndex
CREATE INDEX "erc20_transfers_blockNumber_idx" ON "erc20_transfers"("blockNumber");

-- CreateIndex
CREATE INDEX "erc20_transfers_to_idx" ON "erc20_transfers"("to");

-- CreateIndex
CREATE INDEX "erc20_transfers_tokenAddress_idx" ON "erc20_transfers"("tokenAddress");

-- CreateIndex
CREATE INDEX "erc20_transfers_transactionHash_idx" ON "erc20_transfers"("transactionHash");

-- CreateIndex
CREATE INDEX "swaps_blockNumber_idx" ON "swaps"("blockNumber");

-- CreateIndex
CREATE INDEX "swaps_poolAddress_idx" ON "swaps"("poolAddress");

-- CreateIndex
CREATE INDEX "swaps_recipient_idx" ON "swaps"("recipient");

-- CreateIndex
CREATE INDEX "swaps_transactionHash_idx" ON "swaps"("transactionHash");
