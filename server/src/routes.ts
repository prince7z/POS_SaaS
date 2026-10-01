import { Router } from "express";

import authRouter from "./modules/auth/route";
import catalogRouter from "./modules/catalog/route";
import companyRouter from "./modules/company/route";
import customersRouter from "./modules/customers/route";
import inventoryRouter from "./modules/inventory/route";
import purchasesRouter from "./modules/purchases/route";
import reportsRouter from "./modules/reports/route";
import salesRouter from "./modules/sales/route";

const router = Router();

router.use("/auth", authRouter);
router.use("/company", companyRouter);
router.use("/catalog", catalogRouter);
router.use("/customers", customersRouter);
router.use("/inventory", inventoryRouter);
router.use("/sales", salesRouter);
router.use("/purchases", purchasesRouter);
router.use("/reports", reportsRouter);

export default router;