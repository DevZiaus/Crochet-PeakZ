-- CreateIndex
CREATE INDEX "product_images_product_id_is_primary_display_order_idx" ON "product_images"("product_id", "is_primary", "display_order");

-- CreateIndex
CREATE INDEX "products_is_active_deleted_at_created_at_idx" ON "products"("is_active", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "products_category_id_is_active_deleted_at_created_at_idx" ON "products"("category_id", "is_active", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "products_product_type_is_active_deleted_at_created_at_idx" ON "products"("product_type", "is_active", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "products_is_featured_is_active_deleted_at_created_at_idx" ON "products"("is_featured", "is_active", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "products_price_bdt_idx" ON "products"("price_bdt");

-- CreateIndex
CREATE INDEX "products_price_usd_idx" ON "products"("price_usd");
