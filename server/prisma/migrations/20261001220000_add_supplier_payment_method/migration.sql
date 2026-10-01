-- Add the payment method required by the SupplierPayment model.
ALTER TABLE "SupplierPayment"
ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH';

ALTER TABLE "SupplierPayment"
ALTER COLUMN "paymentMethod" DROP DEFAULT;
