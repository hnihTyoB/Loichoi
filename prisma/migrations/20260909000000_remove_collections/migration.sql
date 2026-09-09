-- DropForeignKey
ALTER TABLE IF EXISTS "collection_items" DROP CONSTRAINT IF EXISTS "collection_items_collection_id_fkey";
ALTER TABLE IF EXISTS "collection_items" DROP CONSTRAINT IF EXISTS "collection_items_keyboard_theme_id_fkey";
ALTER TABLE IF EXISTS "collections" DROP CONSTRAINT IF EXISTS "collections_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "collection_items" CASCADE;
DROP TABLE IF EXISTS "collections" CASCADE;

-- Delete obsolete permissions
DELETE FROM "permissions" WHERE "resource" = 'COLLECTION' OR "name" LIKE 'COLLECTION_%';
