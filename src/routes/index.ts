import { Router } from 'express';
import agencyRoutes from './agency';
import userRoutes from './user';
import leaseRoutes from './lease';
import ownerRoutes from './owner';
import tenantRoutes from './tenant';
import propertyTypeRoutes from './property-type';
import propertyRoutes from './property';
import backupRoutes from './backup';
import dashboardRoutes from "./dashboard";
import favoriteRoutes from "./favorite";
import authRoutes from "./auth";
import userPreferencesRoutes from "./user-preferences";
import FinancialInstitution from "./financial-intitucion";
import FinancialCategory from "./category";
import FinancialSubCategory from "./subcategory";
import FinancialCard from "./card";
import FinancialCenter from "./center";
import FinancialSupplier from "./supplier";
import FinancialTransaction from "./transaction";
import InvoiceRoutes from "./invoice";
import iptuPropertyRoutes from "./iptu-property";
import planningRoutes from "./planning";
import companyRoutes from "./company";
import companiesRoutes from "./companies";
import publicRoutes from "./public";
import { authenticateJWT } from '../middlewares/auth';
import { requireTenant } from '../middlewares/tenant';
import { resolveCompanyBySlug } from '../middlewares/publicTenant';

const router = Router();

// Public routes (no auth required)
router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/public/:companySlug", resolveCompanyBySlug, publicRoutes);

// All routes below require a valid JWT with company_id
router.use(authenticateJWT, requireTenant);

router.use('/agencies', agencyRoutes);
router.use('/users', userRoutes);
router.use('/user-preferences', userPreferencesRoutes);
router.use('/leases', leaseRoutes);
router.use('/owners', ownerRoutes);
router.use('/tenants', tenantRoutes);
router.use('/property-types', propertyTypeRoutes);
router.use('/properties', propertyRoutes);
router.use('/backup', backupRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/financial-institution", FinancialInstitution);
router.use("/financial-category", FinancialCategory);
router.use("/financial-subcategory", FinancialSubCategory);
router.use("/financial-card", FinancialCard);
router.use("/financial-center", FinancialCenter);
router.use("/financial-supplier", FinancialSupplier);
router.use("/financial-transaction", FinancialTransaction);
router.use('/financial-invoice', InvoiceRoutes);
router.use('/iptu-property', iptuPropertyRoutes);
router.use('/planning', planningRoutes);
router.use('/companies', companiesRoutes);

export default router;