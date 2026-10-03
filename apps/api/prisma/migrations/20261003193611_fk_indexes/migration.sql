-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "commission_images_commission_id_idx" ON "commission_images"("commission_id");

-- CreateIndex
CREATE INDEX "custom_commissions_user_id_idx" ON "custom_commissions"("user_id");

-- CreateIndex
CREATE INDEX "custom_commissions_product_id_idx" ON "custom_commissions"("product_id");

-- CreateIndex
CREATE INDEX "digital_assets_product_id_idx" ON "digital_assets"("product_id");

-- CreateIndex
CREATE INDEX "digital_downloads_order_id_idx" ON "digital_downloads"("order_id");

-- CreateIndex
CREATE INDEX "digital_downloads_asset_id_idx" ON "digital_downloads"("asset_id");

-- CreateIndex
CREATE INDEX "digital_downloads_user_id_idx" ON "digital_downloads"("user_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "orders"("coupon_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "reviews_product_id_idx" ON "reviews"("product_id");

-- CreateIndex
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id");
