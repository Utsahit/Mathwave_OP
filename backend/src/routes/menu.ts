import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { menuController } from '../controllers/menu.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  menuQuerySchema,
} from '../validators/menu.validator';
import { AppError } from '../utils/app-error';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, uploadDir);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File validation filter
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid image type. Only JPG, JPEG, PNG, and WEBP allowed.',
        400,
        'INVALID_FILE_TYPE'
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// ── Public Endpoints ──
router.get('/public', menuController.getPublicMenu);
router.get('/public/categories', menuController.getPublicCategories);

// ── Category Admin Endpoints ──
router.post(
  '/categories',
  requireAuth(),
  requirePermission('manage:menu'),
  validate({ body: createCategorySchema }),
  menuController.createCategory
);

router.get(
  '/categories',
  validate({ query: menuQuerySchema }),
  menuController.listCategories
);

router.get('/categories/:id', menuController.getCategory);

router.put(
  '/categories/:id',
  requireAuth(),
  requirePermission('manage:menu'),
  validate({ body: updateCategorySchema }),
  menuController.updateCategory
);

router.delete(
  '/categories/:id',
  requireAuth(),
  requirePermission('manage:menu'),
  menuController.deleteCategory
);

// ── MenuItem Admin Endpoints ──
router.post(
  '/items',
  requireAuth(),
  requirePermission('manage:menu'),
  validate({ body: createMenuItemSchema }),
  menuController.createMenuItem
);

router.get('/items', validate({ query: menuQuerySchema }), menuController.listMenuItems);

router.get('/items/:id', menuController.getMenuItem);

router.put(
  '/items/:id',
  requireAuth(),
  requirePermission('manage:menu'),
  validate({ body: updateMenuItemSchema }),
  menuController.updateMenuItem
);

router.delete(
  '/items/:id',
  requireAuth(),
  requirePermission('manage:menu'),
  menuController.deleteMenuItem
);

// ── MenuItem Image Upload Endpoint ──
router.post(
  '/items/:id/image',
  requireAuth(),
  requirePermission('manage:menu'),
  upload.single('image'),
  menuController.uploadMenuItemImage
);

export default router;
