import { Router } from 'express';
import agencyRoutes from './agency';
import userRoutes from './user';
import leaseRoutes from './lease';
import ownerRoutes from './owner';
import tenantRoutes from './tenant';
import propertyTypeRoutes from './property-type';
import propertyRoutes from './property';
import dashboardRoutes from "./dashboard";
import favoriteRoutes from "./favorite";
import authRoutes from "./auth";

const router = Router();

router.use('/agencies', agencyRoutes);
router.use('/users', userRoutes);
router.use('/leases', leaseRoutes);
router.use('/owners', ownerRoutes);
router.use('/tenants', tenantRoutes);
router.use('/property-types', propertyTypeRoutes);
router.use('/properties', propertyRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/auth", authRoutes);

export default router;