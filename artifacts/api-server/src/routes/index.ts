import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studiesRouter from "./studies";
import participantsRouter from "./participants";
import sessionsRouter from "./sessions";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(studiesRouter);
router.use(participantsRouter);
router.use(sessionsRouter);

export default router;
