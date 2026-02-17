UPDATE "analysis_crons"
SET "cronExpression" = CASE
  WHEN "cronExpression" IS NOT NULL AND BTRIM("cronExpression") <> '' THEN "cronExpression"
  WHEN "intervalSecond" <= 59 THEN '*/' || GREATEST("intervalSecond", 1)::text || ' * * * * *'
  WHEN MOD("intervalSecond", 60) = 0 AND ("intervalSecond" / 60) <= 59
    THEN '0 */' || ("intervalSecond" / 60)::text || ' * * * *'
  ELSE '*/1 * * * * *'
END;

ALTER TABLE "analysis_crons"
ALTER COLUMN "cronExpression" SET NOT NULL;

ALTER TABLE "analysis_crons"
DROP COLUMN "intervalSecond";
