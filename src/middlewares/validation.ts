import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';
import { AgencyValidator } from '../lib/validators/agency';
import { UserValidator } from '../lib/validators/user';
import { LeaseValidator } from '@/lib/validators/lease';
import { OwnerValidator } from '@/lib/validators/owner';
import { TenantValidator } from '@/lib/validators/tenant';
import { PropertyTypeValidator } from '@/lib/validators/property-type';
import { PropertyValidator } from '@/lib/validators/property';

// Validações de Agency
export const validateCreateAgency = (req: Request, res: Response, next: NextFunction) => {
  const validation = AgencyValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateAgency = (req: Request, res: Response, next: NextFunction) => {
  const validation = AgencyValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetAgencies = (req: Request, res: Response, next: NextFunction) => {
  const validation = AgencyValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

// Validações de User
export const validateCreateUser = (req: Request, res: Response, next: NextFunction) => {
  const validation = UserValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateUser = (req: Request, res: Response, next: NextFunction) => {
  const validation = UserValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetUsers = (req: Request, res: Response, next: NextFunction) => {
  const validation = UserValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

// Validações de Lease (novas)
export const validateCreateLease = (req: Request, res: Response, next: NextFunction) => {
  const validation = LeaseValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateLease = (req: Request, res: Response, next: NextFunction) => {
  const validation = LeaseValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetLeases = (req: Request, res: Response, next: NextFunction) => {
  const validation = LeaseValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

// Validações de Owner
export const validateCreateOwner = (req: Request, res: Response, next: NextFunction) => {
  const validation = OwnerValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateOwner = (req: Request, res: Response, next: NextFunction) => {
  const validation = OwnerValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetOwners = (req: Request, res: Response, next: NextFunction) => {
  const validation = OwnerValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateCreateTenant = (req: Request, res: Response, next: NextFunction) => {
  const validation = TenantValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateTenant = (req: Request, res: Response, next: NextFunction) => {
  const validation = TenantValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetTenants = (req: Request, res: Response, next: NextFunction) => {
  const validation = TenantValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

// Validações de PropertyType
export const validateCreatePropertyType = (req: Request, res: Response, next: NextFunction) => {
  const validation = PropertyTypeValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdatePropertyType = (req: Request, res: Response, next: NextFunction) => {
  const validation = PropertyTypeValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetPropertyTypes = (req: Request, res: Response, next: NextFunction) => {
  const validation = PropertyTypeValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

// Validações de Property
export const validateCreateProperty = (req: Request, res: Response, next: NextFunction) => {
  // Para multipart/form-data, a validação é feita no controller
  if (req.is('multipart/form-data')) {
    return next();
  }
  
  const validation = PropertyValidator.validateCreate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateUpdateProperty = (req: Request, res: Response, next: NextFunction) => {
  // Para multipart/form-data, a validação é feita no controller
  if (req.is('multipart/form-data')) {
    return next();
  }
  
  const validation = PropertyValidator.validateUpdate(req.body);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};

export const validateGetProperties = (req: Request, res: Response, next: NextFunction) => {
  const validation = PropertyValidator.validateQueryParams(req.query);
  if (!validation.isValid) {
    return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
  }
  next();
};