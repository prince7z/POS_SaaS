UPDATE "Company"
SET "businessHours" = '{"weekdays":{"open":"08:00","close":"16:00"},"saturdayClosed":true,"sundayClosed":true,"publicHolidaysClosed":true}'::jsonb
WHERE "businessHours" IS NULL;
