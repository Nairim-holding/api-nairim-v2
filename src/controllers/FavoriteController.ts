import { Request, Response } from 'express';
import { FavoriteService } from '../services/FavoriteService';
import { ApiResponse } from '../utils/api-response';
import { ValidationUtil } from '../utils/validation';
import { FavoriteValidator } from '../lib/validators/favorite';

export class FavoriteController {
  static async getFavorites(req: Request, res: Response) {
    try {
      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const user_id = ValidationUtil.parseStringParam(req.query?.user_id);
      const property_id = ValidationUtil.parseStringParam(req.query?.property_id);
      const search = ValidationUtil.parseStringParam(req.query?.search);
      const includeDeleted = ValidationUtil.parseBooleanParam(req.query?.includeDeleted);

      const validation = FavoriteValidator.validateQueryParams(req.query);
      if (!validation.isValid) {
        return res.status(400).json(ApiResponse.error('Validation error', validation.errors));
      }

      const result = await FavoriteService.getFavorites({
        limit,
        page,
        user_id,
        property_id,
        search,
        includeDeleted,
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting favorites:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async getFavoriteById(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }
      
      const favorite = await FavoriteService.getFavoriteById(id);

      res.status(200).json(
        ApiResponse.success(favorite, 'Favorite retrieved successfully')
      );
    } catch (error: any) {
      if (error.message === 'Favorite not found') {
        return res.status(404).json(ApiResponse.error('Favorite not found'));
      }
      console.error('Error getting favorite:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async createFavorite(req: Request, res: Response) {
    try {
      const validation = FavoriteValidator.validateCreate(req.body);
      if (!validation.isValid) {
        return res.status(400).json(
          ApiResponse.error('Validation error', validation.errors)
        );
      }

      const favorite = await FavoriteService.createFavorite(req.body);

      res.status(201).json(
        ApiResponse.success(favorite, 'Favorite created successfully')
      );
    } catch (error: any) {
      console.error('Error creating favorite:', error);

      if (error.message === 'Property already in favorites') {
        return res.status(409).json(ApiResponse.error('Property already in favorites'));
      }

      if (error.message === 'User not found' || error.message === 'Property not found') {
        return res.status(404).json(ApiResponse.error(error.message));
      }

      res.status(400).json(ApiResponse.error(`Error creating favorite: ${error.message}`));
    }
  }

  static async deleteFavorite(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const favorite = await FavoriteService.deleteFavorite(id);

      res.status(200).json(
        ApiResponse.success(null, `Favorite deleted successfully (soft delete)`)
      );
    } catch (error: any) {
      console.error('Error deleting favorite:', error);

      if (error.message === 'Favorite not found or already deleted') {
        return res.status(404).json(ApiResponse.error('Favorite not found or already deleted'));
      }

      res.status(500).json(ApiResponse.error('Error deleting favorite'));
    }
  }

  static async deleteByUserAndProperty(req: Request, res: Response) {
    try {
      const { user_id, property_id } = req.body;

      if (!user_id || !property_id) {
        return res.status(400).json(
          ApiResponse.error('user_id and property_id are required')
        );
      }

      const favorite = await FavoriteService.deleteFavoriteByUserAndProperty(user_id, property_id);

      res.status(200).json(
        ApiResponse.success(null, `Favorite deleted successfully (soft delete)`)
      );
    } catch (error: any) {
      console.error('Error deleting favorite by user and property:', error);

      if (error.message === 'Favorite not found') {
        return res.status(404).json(ApiResponse.error('Favorite not found'));
      }

      res.status(500).json(ApiResponse.error('Error deleting favorite'));
    }
  }

  static async restoreFavorite(req: Request, res: Response) {
    try {
      const id = String(req.params?.id || '');
      if (!id) {
        return res.status(400).json(ApiResponse.error('ID is required'));
      }

      const favorite = await FavoriteService.restoreFavorite(id);

      res.status(200).json(
        ApiResponse.success(null, `Favorite restored successfully`)
      );
    } catch (error: any) {
      console.error('Error restoring favorite:', error);

      if (error.message === 'Favorite not found') {
        return res.status(404).json(ApiResponse.error('Favorite not found'));
      }

      if (error.message === 'Favorite is not deleted') {
        return res.status(400).json(ApiResponse.error('Favorite is not deleted'));
      }

      res.status(500).json(ApiResponse.error('Error restoring favorite'));
    }
  }

  static async getUserFavorites(req: Request, res: Response) {
    try {
      const user_id = String(req.params?.user_id || '');
      if (!user_id) {
        return res.status(400).json(ApiResponse.error('user_id is required'));
      }

      const limit = ValidationUtil.parseNumberParam(req.query?.limit, 10);
      const page = ValidationUtil.parseNumberParam(req.query?.page, 1);
      const includeDeleted = ValidationUtil.parseBooleanParam(req.query?.includeDeleted);

      const result = await FavoriteService.getUserFavorites(user_id, {
        limit,
        page,
        includeDeleted
      });

      res.status(200).json(result);

    } catch (error: any) {
      console.error('Error getting user favorites:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }

  static async checkFavorite(req: Request, res: Response) {
    try {
      const { user_id, property_id } = req.query;

      if (!user_id || !property_id) {
        return res.status(400).json(
          ApiResponse.error('user_id and property_id are required')
        );
      }

      const result = await FavoriteService.checkIfFavorite(
        String(user_id),
        String(property_id)
      );

      res.status(200).json(
        ApiResponse.success(result, 'Favorite status retrieved successfully')
      );
    } catch (error: any) {
      console.error('Error checking favorite:', error);
      res.status(500).json(ApiResponse.error('Internal server error'));
    }
  }
}