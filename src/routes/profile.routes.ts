import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import * as profileController from '../controllers/profile.controller';

/**
 * Profile Routes
 * All routes require authentication
 */

const router = Router();

// Configure multer for memory storage (for Cloudinary upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// GET /api/profile - Get current user's profile
router.get('/', profileController.getProfile);

// PATCH /api/profile - Update profile (name)
router.patch('/', profileController.updateProfile);

// POST /api/profile/avatar - Upload avatar
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar);

// DELETE /api/profile/avatar - Delete avatar
router.delete('/avatar', profileController.deleteAvatar);

// GET /api/profile/stats - Get profile statistics
router.get('/stats', profileController.getProfileStats);

export default router;
