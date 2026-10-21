-- When this listener's id was last exchanged for a session cookie.
--
-- The restore endpoint hands a session to whoever names an id, which is how
-- an id stayed a password even after the cookie landed. It can only do that
-- once per listener now: the owner's next visit binds them, and the same id
-- offered afterwards gets nothing.
ALTER TABLE "Fan" ADD COLUMN "sessionBoundAt" TIMESTAMP(3);
