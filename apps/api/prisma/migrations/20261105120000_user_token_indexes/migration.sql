-- CreateIndex: verification and reset links look accounts up by token hash, so
-- index the nullable token columns to keep those probes off sequential scans.
CREATE INDEX "users_email_verification_token_idx" ON "users"("email_verification_token");

-- CreateIndex
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");
