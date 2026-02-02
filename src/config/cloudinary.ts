import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

/**
 * Initialize Cloudinary SDK with environment configuration
 */
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
