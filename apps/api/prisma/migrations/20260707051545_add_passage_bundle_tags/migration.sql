-- CreateTable
CREATE TABLE "passage_bundle_tags" (
    "bundle_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "passage_bundle_tags_pkey" PRIMARY KEY ("bundle_id","tag_id")
);

-- AddForeignKey
ALTER TABLE "passage_bundle_tags" ADD CONSTRAINT "passage_bundle_tags_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "passage_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passage_bundle_tags" ADD CONSTRAINT "passage_bundle_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
