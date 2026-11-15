-- Time left on a Spotlight that was put back in the queue.
--
-- A queued Spotlight normally starts its full run when a tile frees. One
-- that was already running and got moved back has had some of its time, so
-- it has to resume with what was left rather than restart. Null means a
-- full run, which is every ordinary purchase.
ALTER TABLE "Spotlight" ADD COLUMN "remainingMs" INTEGER;
