import { v2 as cloudinary } from 'cloudinary';

// Explicit config from CLOUDINARY_URL (format: cloudinary://key:secret@cloud_name)
// The SDK auto-reads CLOUDINARY_URL, but we call config() to ensure it's loaded
// after dotenv.config() has run.
export function initCloudinary(): void {
  const url = process.env['CLOUDINARY_URL'];
  if (!url) {
    console.warn('CLOUDINARY_URL not set — photo uploads will fail');
    return;
  }
  // Parse cloudinary://api_key:api_secret@cloud_name
  const match = url.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({
      cloud_name: match[3],
      api_key: match[1],
      api_secret: match[2],
    });
  }
}

export async function deletePhoto(url: string): Promise<void> {
  // Extract public_id from Cloudinary URL
  // URL format: https://res.cloudinary.com/<cloud>/image/upload/v123/herbia/plants/plant_1_1234.jpg
  const match = url.match(/\/upload\/(?:v\d+\/)?(herbia\/plants\/[^.]+)/);
  if (!match) return;
  await cloudinary.uploader.destroy(match[1]);
}

export function uploadPhoto(buffer: Buffer, plantId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'herbia/plants',
        public_id: `plant_${plantId}_${Date.now()}`,
        transformation: [
          { width: 1024, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('No result from Cloudinary'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
