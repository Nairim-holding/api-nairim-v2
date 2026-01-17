import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json(
      ApiResponse.error('Validation error', [error.message])
    );
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    if (error.message.includes('Record to update not found')) {
      return res.status(404).json(ApiResponse.error('Resource not found'));
    }
    
    if (error.message.includes('Unique constraint failed')) {
      return res.status(409).json(ApiResponse.error('Duplicate entry', ['Resource already exists']));
    }
  }

  if (error.message.includes('not found')) {
    return res.status(404).json(ApiResponse.error('Resource not found'));
  }

  return res.status(500).json(ApiResponse.error('Internal server error'));
};