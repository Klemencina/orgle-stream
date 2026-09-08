CREATE TABLE "festival_passes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" TEXT NOT NULL,
    "stripePriceId" VARCHAR(255) NOT NULL,
    "stripePaymentIntentId" VARCHAR(255),
    "stripeCheckoutSessionId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "festival_passes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "festival_passes_userId_year_key" ON "festival_passes"("userId", "year");
