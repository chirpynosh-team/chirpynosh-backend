import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as profileService from '../services/profile.service';
import type { ApiResponse, SafeUser } from '../types/index';

/**
 * Profile Controller
 * Handles HTTP requests for user profile operations
 */

/**
 * GET /profile
 * Get current user's profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const user = await profileService.getUserById(req.user.userId);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
  };

  res.status(200).json(response);
});

/**
 * PATCH /profile
 * Update current user's profile (name)
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const { name } = req.body as { name?: string };
  
  // Build update data object, only including defined values
  const updateData: { name?: string } = {};
  if (name !== undefined) {
    updateData.name = name;
  }

  const user = await profileService.updateProfile(req.user.userId, updateData);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Profile updated successfully',
  };

  res.status(200).json(response);
});

/**
 * POST /profile/avatar
 * Upload new avatar
 */
export const uploadAvatar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  if (!req.file) {
    throw AppError.badRequest('No file uploaded');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    throw AppError.badRequest('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (req.file.size > maxSize) {
    throw AppError.badRequest('File too large. Maximum size is 5MB.');
  }

  const user = await profileService.updateAvatar(req.user.userId, req.file.buffer);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Avatar uploaded successfully',
  };

  res.status(200).json(response);
});

/**
 * DELETE /profile/avatar
 * Delete current avatar
 */
export const deleteAvatar = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const user = await profileService.deleteUserAvatar(req.user.userId);

  const response: ApiResponse<SafeUser> = {
    success: true,
    data: user,
    message: 'Avatar deleted successfully',
  };

  res.status(200).json(response);
});

/**
 * GET /profile/stats
 * Get profile statistics
 */
export const getProfileStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const stats = await profileService.getProfileStats(req.user.userId);

  const response: ApiResponse<typeof stats> = {
    success: true,
    data: stats,
  };

  res.status(200).json(response);
});
