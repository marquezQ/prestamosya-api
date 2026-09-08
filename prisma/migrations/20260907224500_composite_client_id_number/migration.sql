-- DropIndex
DROP INDEX IF EXISTS "clients_id_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "clients_user_id_id_number_key" ON "clients"("user_id", "id_number");
