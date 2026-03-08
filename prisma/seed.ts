/**
 * 🌱 ChirpyNosh Database Seed Script (v3)
 *
 * Creates comprehensive demo data that works end-to-end:
 *  - Finds or creates mhassanali1210@gmail.com user + SUPPLIER org "Foodies"
 *  - 4 additional seed vendor orgs (all verified with KYC + at least 1 doc)
 *  - 1 verified NGO org for NGO claim testing
 *  - 1 SIMPLE_RECIPIENT user for individual claim testing
 *  - 30 food listings (~60% belong to primary user's "Foodies")
 *  - Real claims with working pickup OTPs (PENDING, COMPLETED, CANCELLED)
 *
 * Run:  npm run seed   (or: npx tsx prisma/seed.ts)
 * Safe to re-run – only deletes seed-created data, preserves primary user.
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ============================================================================
// CONFIG
// ============================================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PRIMARY_USER_EMAIL = 'mhassanali1210@gmail.com';
const PRIMARY_ORG_NAME = 'Foodies';
const SEED_PASSWORD = 'Seed@12345';
const SALT_ROUNDS = 12;

// ============================================================================
// FOOD IMAGE URLS (Unsplash – stable direct links)
// ============================================================================

const FOOD_IMAGES: Record<string, string[]> = {
  'Cooked Meals': [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop',
  ],
  'Bakery & Bread': [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800&h=600&fit=crop',
  ],
  'Fresh Produce': [
    'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&h=600&fit=crop',
  ],
  'Dairy Products': [
    'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?w=800&h=600&fit=crop',
  ],
  'Packaged Foods': [
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1612257416648-ee7a6c5b4f9b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1600803907087-f56d462fd26b?w=800&h=600&fit=crop',
  ],
  Beverages: [
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&h=600&fit=crop',
  ],
  Snacks: [
    'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=600&fit=crop',
  ],
  Groceries: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1543168256-418811576931?w=800&h=600&fit=crop',
  ],
};

// ============================================================================
// LISTING TEMPLATES — 30 listings
// ============================================================================

interface ListingTemplate {
  title: string;
  description: string;
  category: string;
  unit: string;
  minStock: number;
  maxStock: number;
  originalPrice: number;
  subsidizedPrice: number;
  claimerType: 'NGO' | 'INDIVIDUAL' | 'BOTH';
}

const LISTING_TEMPLATES: ListingTemplate[] = [
  // Cooked Meals (6)
  { title: 'Chicken Biryani – Family Pack', description: 'Aromatic basmati rice layered with tender chicken, spices, and fresh herbs. Serves 4-5 people.', category: 'Cooked Meals', unit: 'Portions', minStock: 8, maxStock: 25, originalPrice: 12.99, subsidizedPrice: 4.99, claimerType: 'BOTH' },
  { title: 'Vegetable Pasta Bowls', description: 'Penne pasta tossed with seasonal grilled vegetables, sun-dried tomatoes, and basil pesto cream sauce.', category: 'Cooked Meals', unit: 'Portions', minStock: 10, maxStock: 30, originalPrice: 8.50, subsidizedPrice: 3.00, claimerType: 'BOTH' },
  { title: 'Grilled Salmon with Rice', description: 'Atlantic salmon fillet grilled to perfection, served with jasmine rice and steamed broccoli.', category: 'Cooked Meals', unit: 'Plates', minStock: 5, maxStock: 15, originalPrice: 15.00, subsidizedPrice: 6.50, claimerType: 'BOTH' },
  { title: 'Lentil & Chickpea Curry', description: 'Hearty plant-based curry with red lentils, chickpeas, coconut milk, and warming spices. Vegan-friendly.', category: 'Cooked Meals', unit: 'Portions', minStock: 12, maxStock: 40, originalPrice: 7.00, subsidizedPrice: 2.50, claimerType: 'BOTH' },
  { title: 'Beef Stew – Home Style', description: 'Slow-cooked beef chunks with carrots, potatoes, and celery in a rich tomato-herb broth.', category: 'Cooked Meals', unit: 'Portions', minStock: 6, maxStock: 20, originalPrice: 11.00, subsidizedPrice: 4.00, claimerType: 'BOTH' },
  { title: 'Butter Chicken with Naan', description: 'Creamy tomato-based butter chicken served with freshly baked garlic naan bread.', category: 'Cooked Meals', unit: 'Portions', minStock: 10, maxStock: 30, originalPrice: 10.00, subsidizedPrice: 3.50, claimerType: 'BOTH' },

  // Bakery & Bread (4)
  { title: 'Assorted Artisan Bread Loaves', description: 'Freshly baked sourdough, whole wheat, and multigrain loaves. Baked this morning.', category: 'Bakery & Bread', unit: 'Boxes', minStock: 10, maxStock: 35, originalPrice: 6.00, subsidizedPrice: 2.00, claimerType: 'BOTH' },
  { title: 'Croissants & Danish Pastries', description: 'Butter croissants and assorted Danish pastries with fruit filling. Perfect for breakfast.', category: 'Bakery & Bread', unit: 'Boxes', minStock: 8, maxStock: 20, originalPrice: 9.00, subsidizedPrice: 3.50, claimerType: 'BOTH' },
  { title: 'Whole Wheat Sandwich Bread', description: '100% whole wheat sliced bread, no preservatives. Great for sandwiches and toast.', category: 'Bakery & Bread', unit: 'Packs', minStock: 15, maxStock: 50, originalPrice: 4.50, subsidizedPrice: 1.50, claimerType: 'BOTH' },
  { title: 'Mixed Muffins & Cupcakes', description: 'Blueberry muffins, chocolate cupcakes, and vanilla bean muffins. 6 pieces per box.', category: 'Bakery & Bread', unit: 'Boxes', minStock: 10, maxStock: 25, originalPrice: 8.00, subsidizedPrice: 3.00, claimerType: 'BOTH' },

  // Fresh Produce (4)
  { title: 'Seasonal Fruit Basket', description: 'Fresh mix of apples, oranges, bananas, and seasonal berries. Approximately 3kg per basket.', category: 'Fresh Produce', unit: 'Bags', minStock: 10, maxStock: 30, originalPrice: 10.00, subsidizedPrice: 4.00, claimerType: 'BOTH' },
  { title: 'Mixed Salad Greens', description: 'Pre-washed baby spinach, arugula, and romaine lettuce mix. Ready to eat.', category: 'Fresh Produce', unit: 'Bags', minStock: 15, maxStock: 40, originalPrice: 5.50, subsidizedPrice: 2.00, claimerType: 'BOTH' },
  { title: 'Organic Vegetable Box', description: 'Locally sourced organic vegetables: tomatoes, cucumbers, bell peppers, zucchini, and carrots.', category: 'Fresh Produce', unit: 'Boxes', minStock: 8, maxStock: 20, originalPrice: 14.00, subsidizedPrice: 5.50, claimerType: 'BOTH' },
  { title: 'Fresh Herb Bundle', description: 'Basil, cilantro, parsley, and mint. Farm-fresh and aromatic.', category: 'Fresh Produce', unit: 'Packs', minStock: 20, maxStock: 50, originalPrice: 3.00, subsidizedPrice: 1.00, claimerType: 'BOTH' },

  // Dairy Products (3)
  { title: 'Milk & Yogurt Combo', description: 'Fresh whole milk (2L) and plain Greek yogurt (500g). Best consumed within 3 days.', category: 'Dairy Products', unit: 'Packs', minStock: 10, maxStock: 25, originalPrice: 7.50, subsidizedPrice: 3.00, claimerType: 'BOTH' },
  { title: 'Artisan Cheese Selection', description: 'Cheddar, mozzarella, and gouda cheese slices. Vacuum-sealed for freshness.', category: 'Dairy Products', unit: 'Packs', minStock: 8, maxStock: 20, originalPrice: 12.00, subsidizedPrice: 5.00, claimerType: 'BOTH' },
  { title: 'Eggs – Free Range (Dozen)', description: 'Farm-fresh free-range eggs, dozen per pack. Excellent for baking and cooking.', category: 'Dairy Products', unit: 'Packs', minStock: 15, maxStock: 40, originalPrice: 5.00, subsidizedPrice: 2.00, claimerType: 'BOTH' },

  // Packaged Foods (3)
  { title: 'Canned Soup Variety Pack', description: 'Assorted canned soups: tomato, chicken noodle, and minestrone. 4 cans per pack.', category: 'Packaged Foods', unit: 'Packs', minStock: 12, maxStock: 35, originalPrice: 8.00, subsidizedPrice: 3.00, claimerType: 'BOTH' },
  { title: 'Rice & Pasta Essentials', description: 'Basmati rice (2kg) and penne pasta (500g). Pantry staples at a great price.', category: 'Packaged Foods', unit: 'Packs', minStock: 10, maxStock: 30, originalPrice: 6.50, subsidizedPrice: 2.50, claimerType: 'BOTH' },
  { title: 'Instant Noodle Bundle', description: '10-pack assorted instant noodles. Quick meals for busy days.', category: 'Packaged Foods', unit: 'Packs', minStock: 20, maxStock: 50, originalPrice: 5.00, subsidizedPrice: 2.00, claimerType: 'BOTH' },

  // Beverages (2)
  { title: 'Fresh Orange Juice – Bulk', description: 'Freshly squeezed orange juice, no added sugar. 1L bottles.', category: 'Beverages', unit: 'Liters', minStock: 10, maxStock: 30, originalPrice: 4.50, subsidizedPrice: 1.50, claimerType: 'BOTH' },
  { title: 'Herbal Tea Collection', description: 'Chamomile, peppermint, and green tea bags. 20 bags per box.', category: 'Beverages', unit: 'Boxes', minStock: 15, maxStock: 40, originalPrice: 6.00, subsidizedPrice: 2.00, claimerType: 'BOTH' },

  // Snacks (3)
  { title: 'Mixed Nuts & Dried Fruits', description: 'Almonds, cashews, walnuts, raisins, and dried cranberries. High-protein snack.', category: 'Snacks', unit: 'Bags', minStock: 12, maxStock: 30, originalPrice: 9.00, subsidizedPrice: 3.50, claimerType: 'BOTH' },
  { title: 'Granola Bar Variety Pack', description: 'Oat, honey, and chocolate chip granola bars. 12 bars per pack.', category: 'Snacks', unit: 'Packs', minStock: 15, maxStock: 40, originalPrice: 7.00, subsidizedPrice: 2.50, claimerType: 'BOTH' },
  { title: 'Fresh Fruit Cups', description: 'Ready-to-eat fruit cups with mango, pineapple, and melon. Perfect for on-the-go.', category: 'Snacks', unit: 'Units', minStock: 20, maxStock: 50, originalPrice: 3.50, subsidizedPrice: 1.00, claimerType: 'BOTH' },

  // Groceries (5)
  { title: 'Family Grocery Bundle', description: 'Rice, lentils, cooking oil, canned beans, and spice packets. Feeds a family of 4 for a week.', category: 'Groceries', unit: 'Boxes', minStock: 5, maxStock: 15, originalPrice: 25.00, subsidizedPrice: 10.00, claimerType: 'BOTH' },
  { title: 'Breakfast Essentials Pack', description: 'Cereal, oats, jam, peanut butter, and bread. Start your mornings right.', category: 'Groceries', unit: 'Boxes', minStock: 8, maxStock: 20, originalPrice: 15.00, subsidizedPrice: 6.00, claimerType: 'BOTH' },
  { title: 'Spice & Condiment Set', description: 'Salt, pepper, cumin, turmeric, chili powder, soy sauce, and olive oil. Kitchen essentials.', category: 'Groceries', unit: 'Packs', minStock: 10, maxStock: 25, originalPrice: 12.00, subsidizedPrice: 4.50, claimerType: 'BOTH' },
  { title: 'Cooking Oil & Flour Bundle', description: 'Sunflower oil (1L) and all-purpose flour (2kg). Baking and cooking basics.', category: 'Groceries', unit: 'Packs', minStock: 12, maxStock: 30, originalPrice: 8.00, subsidizedPrice: 3.00, claimerType: 'BOTH' },
  { title: 'Weekly Essentials Kit', description: 'Bread, eggs, milk, butter, and seasonal fruit. A curated weekly basket for 2 people.', category: 'Groceries', unit: 'Boxes', minStock: 6, maxStock: 18, originalPrice: 18.00, subsidizedPrice: 7.00, claimerType: 'BOTH' },
];

// ============================================================================
// SEED VENDORS (fake accounts — created and deleted by seed)
// ============================================================================

interface SeedVendorDef {
  email: string;
  name: string;
  orgName: string;
  businessAddress: string;
  phoneNumber: string;
  taxId: string;
}

const SEED_VENDORS: SeedVendorDef[] = [
  {
    email: 'greenleaf.supplier@example.com',
    name: 'Sarah Mitchell',
    orgName: 'GreenLeaf Organics',
    businessAddress: '45 Harvest Lane, Manchester M1 2AB',
    phoneNumber: '+44 161 234 5678',
    taxId: 'GB123456789',
  },
  {
    email: 'sunrise.bakery@example.com',
    name: 'James Watson',
    orgName: 'Sunrise Bakery & Co.',
    businessAddress: '78 Baker Street, Birmingham B2 5RS',
    phoneNumber: '+44 121 345 6789',
    taxId: 'GB987654321',
  },
  {
    email: 'farmfresh.hub@example.com',
    name: 'Priya Sharma',
    orgName: 'FarmFresh Hub',
    businessAddress: '33 Station Road, Leeds LS1 4DY',
    phoneNumber: '+44 113 456 7890',
    taxId: 'GB456789123',
  },
  {
    email: 'dailybites.catering@example.com',
    name: 'Omar Farouk',
    orgName: 'DailyBites Catering',
    businessAddress: '91 High Street, Bristol BS1 3EP',
    phoneNumber: '+44 117 567 8901',
    taxId: 'GB789123456',
  },
];

// NGO account for testing NGO claims
const SEED_NGO = {
  email: 'hopebridgefoundation@example.com',
  name: 'Aisha Khan',
  orgName: 'HopeBridge Foundation',
  businessAddress: '12 Charity Row, London EC1A 4QN',
  phoneNumber: '+44 207 890 1234',
  taxId: 'GB111222333',
};

// Simple recipient for individual claims
const TEST_RECIPIENT = {
  email: 'testclaimer@example.com',
  name: 'Alex Johnson',
};

// All seed-only emails (NEVER includes PRIMARY_USER_EMAIL)
const SEED_ONLY_EMAILS = [
  ...SEED_VENDORS.map((v) => v.email),
  SEED_NGO.email,
  TEST_RECIPIENT.email,
];

// ============================================================================
// HELPERS
// ============================================================================

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function uploadToCloudinary(url: string, publicId: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(url, {
      public_id: publicId,
      folder: 'seed-listings',
      overwrite: true,
      transformation: [{ width: 800, height: 600, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
    });
    return result.public_id;
  } catch {
    console.warn(`⚠️  Failed to upload ${publicId}, using fallback`);
    return `seed-listings/${publicId}`;
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(n, arr.length));
}

function futureDate(daysFromNow: number, hour: number = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Starting ChirpyNosh seed (v3)...\n');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Find or create the primary user and their SUPPLIER org
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`🔍 Looking up primary user: ${PRIMARY_USER_EMAIL}`);

  let primaryUser = await prisma.user.findUnique({
    where: { email: PRIMARY_USER_EMAIL },
    include: {
      orgMemberships: { include: { org: true } },
    },
  });

  let primaryOrg: { id: string; name: string };

  if (!primaryUser) {
    // Create the primary user from scratch
    console.log(`  ⚠️  User not found — creating ${PRIMARY_USER_EMAIL}...`);
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

    primaryUser = await prisma.user.create({
      data: {
        email: PRIMARY_USER_EMAIL,
        passwordHash,
        name: 'Hassan Ali',
        role: 'FOOD_SUPPLIER',
        isEmailVerified: true,
        authProvider: 'EMAIL',
      },
      include: {
        orgMemberships: { include: { org: true } },
      },
    });
    console.log(`  ✅ Created user: ${primaryUser.id}`);
  }

  // Check for existing SUPPLIER org
  const supplierMembership = primaryUser.orgMemberships.find(
    (m) => m.org.type === 'SUPPLIER'
  );

  if (supplierMembership) {
    primaryOrg = { id: supplierMembership.org.id, name: supplierMembership.org.name };
    console.log(`  ✅ Found existing org: "${primaryOrg.name}" (${primaryOrg.id})`);

    // Ensure it's verified
    if (!supplierMembership.org.isVerified) {
      await prisma.organization.update({
        where: { id: primaryOrg.id },
        data: { isVerified: true, verifiedAt: new Date(), verifiedBy: 'seed-script' },
      });
      console.log('  🔓 Marked org as verified');
    }
  } else {
    // Create org + membership
    console.log(`  ⚠️  No SUPPLIER org found — creating "${PRIMARY_ORG_NAME}"...`);
    const org = await prisma.organization.create({
      data: {
        type: 'SUPPLIER',
        name: PRIMARY_ORG_NAME,
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: 'seed-script',
      },
    });

    await prisma.orgMember.create({
      data: { userId: primaryUser.id, orgId: org.id, orgRole: 'OWNER' },
    });

    primaryOrg = { id: org.id, name: org.name };
    console.log(`  ✅ Created org: "${primaryOrg.name}" (${primaryOrg.id})`);

    // Ensure user role is FOOD_SUPPLIER
    if (primaryUser.role !== 'FOOD_SUPPLIER') {
      await prisma.user.update({
        where: { id: primaryUser.id },
        data: { role: 'FOOD_SUPPLIER' },
      });
    }
  }

  // Ensure KYC exists for primary org
  let primaryKyc = await prisma.kycSubmission.findUnique({
    where: { orgId: primaryOrg.id },
  });

  if (!primaryKyc) {
    primaryKyc = await prisma.kycSubmission.create({
      data: {
        orgId: primaryOrg.id,
        status: 'APPROVED',
        businessRegisteredName: 'Foodies Food Services Ltd.',
        taxId: 'GB000111222',
        phoneNumber: '+44 20 7946 0958',
        businessAddress: '221B Baker Street, London NW1 6XE',
        idProofKey: 'kyc/seed-primary-id-proof',
        registrationDocKey: 'kyc/seed-primary-registration',
        submittedAt: pastDate(15),
        reviewedAt: pastDate(10),
        reviewedBy: 'seed-script',
        reviewNotes: 'Auto-approved by seed script',
      },
    });
    console.log('  📋 Created KYC submission (APPROVED)');
  } else if (primaryKyc.status !== 'APPROVED') {
    await prisma.kycSubmission.update({
      where: { id: primaryKyc.id },
      data: {
        status: 'APPROVED',
        businessRegisteredName: primaryKyc.businessRegisteredName || 'Foodies Food Services Ltd.',
        taxId: primaryKyc.taxId || 'GB000111222',
        phoneNumber: primaryKyc.phoneNumber || '+44 20 7946 0958',
        businessAddress: primaryKyc.businessAddress || '221B Baker Street, London NW1 6XE',
        idProofKey: primaryKyc.idProofKey || 'kyc/seed-primary-id-proof',
        submittedAt: primaryKyc.submittedAt || pastDate(15),
        reviewedAt: new Date(),
        reviewedBy: 'seed-script',
        reviewNotes: 'Auto-approved by seed script',
      },
    });
    console.log('  📋 Updated KYC to APPROVED');
  } else {
    console.log('  📋 KYC already APPROVED');
  }

  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Clean up previous seed data (NEVER touches primary user/org)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🧹 Cleaning up previous seed data...');

  // Find seed-only users
  const existingSeedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_ONLY_EMAILS } },
    select: { id: true },
  });
  const seedUserIds = existingSeedUsers.map((u) => u.id);

  // Delete claims made by seed users
  if (seedUserIds.length > 0) {
    await prisma.foodClaim.deleteMany({
      where: { claimerId: { in: seedUserIds } },
    });
  }

  // Delete claims on primary org's seed-titled listings
  const seedTitles = LISTING_TEMPLATES.map((t) => t.title);
  const primarySeedListings = await prisma.foodListing.findMany({
    where: { orgId: primaryOrg.id, title: { in: seedTitles } },
    select: { id: true },
  });
  if (primarySeedListings.length > 0) {
    await prisma.foodClaim.deleteMany({
      where: { listingId: { in: primarySeedListings.map((l) => l.id) } },
    });
  }

  // Delete seed-only org data
  if (seedUserIds.length > 0) {
    const seedOrgMembers = await prisma.orgMember.findMany({
      where: { userId: { in: seedUserIds } },
      select: { orgId: true },
    });
    const seedOrgIds = [...new Set(seedOrgMembers.map((m) => m.orgId))];

    if (seedOrgIds.length > 0) {
      // Delete claims on seed org listings
      const seedOrgListings = await prisma.foodListing.findMany({
        where: { orgId: { in: seedOrgIds } },
        select: { id: true },
      });
      if (seedOrgListings.length > 0) {
        await prisma.foodClaim.deleteMany({
          where: { listingId: { in: seedOrgListings.map((l) => l.id) } },
        });
      }

      await prisma.foodListing.deleteMany({ where: { orgId: { in: seedOrgIds } } });
      await prisma.kycSubmission.deleteMany({ where: { orgId: { in: seedOrgIds } } });
      await prisma.orgMember.deleteMany({ where: { orgId: { in: seedOrgIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: seedOrgIds } } });
    }
  }

  // Delete seed-titled listings from primary org
  await prisma.foodListing.deleteMany({
    where: { orgId: primaryOrg.id, title: { in: seedTitles } },
  });

  // Delete seed-only users
  await prisma.otp.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: seedUserIds } } });
  await prisma.user.deleteMany({ where: { email: { in: SEED_ONLY_EMAILS } } });

  console.log('  ✅ Cleanup complete\n');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Upload food images to Cloudinary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📸 Uploading food images to Cloudinary...');

  const categoryImageKeys: Record<string, string[]> = {};

  for (const [category, urls] of Object.entries(FOOD_IMAGES)) {
    const keys: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const publicId = `${slug}-${i + 1}`;
      console.log(`  📷 ${category} image ${i + 1}/${urls.length}...`);
      const key = await uploadToCloudinary(urls[i]!, publicId);
      keys.push(key);
    }
    categoryImageKeys[category] = keys;
    console.log(`  ✅ ${category}: ${keys.length} images`);
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Create seed vendor orgs (all verified with KYC)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('👥 Creating seed vendor organizations...');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  const vendorOrgMap: Record<string, string> = {}; // email -> orgId
  vendorOrgMap[PRIMARY_USER_EMAIL] = primaryOrg.id;
  const allVendorOrgIds: string[] = [primaryOrg.id];

  for (const vendor of SEED_VENDORS) {
    const user = await prisma.user.create({
      data: {
        email: vendor.email,
        passwordHash,
        name: vendor.name,
        role: 'FOOD_SUPPLIER',
        isEmailVerified: true,
        authProvider: 'EMAIL',
      },
    });

    const org = await prisma.organization.create({
      data: {
        type: 'SUPPLIER',
        name: vendor.orgName,
        isVerified: true,
        verifiedAt: pastDate(randomInt(7, 30)),
        verifiedBy: 'seed-script',
      },
    });

    await prisma.orgMember.create({
      data: { userId: user.id, orgId: org.id, orgRole: 'OWNER' },
    });

    // Create KYC with at least 1 doc
    await prisma.kycSubmission.create({
      data: {
        orgId: org.id,
        status: 'APPROVED',
        businessRegisteredName: vendor.orgName,
        taxId: vendor.taxId,
        phoneNumber: vendor.phoneNumber,
        businessAddress: vendor.businessAddress,
        idProofKey: `kyc/seed-${org.id}-id-proof`,
        registrationDocKey: `kyc/seed-${org.id}-registration`,
        businessLicenseKey: `kyc/seed-${org.id}-license`,
        submittedAt: pastDate(randomInt(14, 30)),
        reviewedAt: pastDate(randomInt(5, 13)),
        reviewedBy: 'seed-script',
        reviewNotes: 'Auto-approved (seed data)',
      },
    });

    vendorOrgMap[vendor.email] = org.id;
    allVendorOrgIds.push(org.id);
    console.log(`  ✅ ${vendor.orgName} (${vendor.email})`);
  }
  console.log(`  ⭐ ${primaryOrg.name} (${PRIMARY_USER_EMAIL}) — preserved\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Create NGO org (verified) for NGO claim testing
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🏢 Creating NGO organization...');

  const ngoUser = await prisma.user.create({
    data: {
      email: SEED_NGO.email,
      passwordHash,
      name: SEED_NGO.name,
      role: 'NGO_RECIPIENT',
      isEmailVerified: true,
      authProvider: 'EMAIL',
    },
  });

  const ngoOrg = await prisma.organization.create({
    data: {
      type: 'NGO',
      name: SEED_NGO.orgName,
      isVerified: true,
      verifiedAt: pastDate(20),
      verifiedBy: 'seed-script',
    },
  });

  await prisma.orgMember.create({
    data: { userId: ngoUser.id, orgId: ngoOrg.id, orgRole: 'OWNER' },
  });

  await prisma.kycSubmission.create({
    data: {
      orgId: ngoOrg.id,
      status: 'APPROVED',
      businessRegisteredName: SEED_NGO.orgName,
      taxId: SEED_NGO.taxId,
      phoneNumber: SEED_NGO.phoneNumber,
      businessAddress: SEED_NGO.businessAddress,
      idProofKey: `kyc/seed-${ngoOrg.id}-id-proof`,
      registrationDocKey: `kyc/seed-${ngoOrg.id}-ngo-registration`,
      submittedAt: pastDate(25),
      reviewedAt: pastDate(20),
      reviewedBy: 'seed-script',
      reviewNotes: 'Auto-approved (seed data)',
    },
  });

  console.log(`  ✅ ${SEED_NGO.orgName} (${SEED_NGO.email})\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6: Create test recipient
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🧑 Creating test recipient...');

  const recipientUser = await prisma.user.create({
    data: {
      email: TEST_RECIPIENT.email,
      passwordHash,
      name: TEST_RECIPIENT.name,
      role: 'SIMPLE_RECIPIENT',
      isEmailVerified: true,
      authProvider: 'EMAIL',
    },
  });

  console.log(`  ✅ ${TEST_RECIPIENT.email} (SIMPLE_RECIPIENT)\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7: Create food listings
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🍽️  Creating food listings...');

  const now = new Date();
  const otherOrgIds = allVendorOrgIds.filter((id) => id !== primaryOrg.id);

  // Track created listings for claim creation
  interface CreatedListing {
    id: string;
    title: string;
    orgId: string;
    subsidizedPrice: number;
    unit: string;
    remainingStock: number;
  }
  const createdListings: CreatedListing[] = [];

  // Deterministic assignment: first 18 (~60%) go to primary, rest to others
  for (let i = 0; i < LISTING_TEMPLATES.length; i++) {
    const template = LISTING_TEMPLATES[i]!;

    const orgId = i < 18 ? primaryOrg.id : pickRandom(otherOrgIds);

    // Pickup window: starts today or tomorrow, lasts 5 days
    const pickupStartOffset = randomInt(0, 1);
    const pickupStartAt = new Date(now);
    pickupStartAt.setDate(pickupStartAt.getDate() + pickupStartOffset);
    pickupStartAt.setHours(8, 0, 0, 0);

    const pickupEndAt = new Date(pickupStartAt);
    pickupEndAt.setDate(pickupEndAt.getDate() + 5);
    pickupEndAt.setHours(20, 0, 0, 0);

    // Expiry: 5-8 days from now
    const expiresAt = futureDate(randomInt(5, 8), 23);

    // Images: 1-3 from the category
    const catImages = categoryImageKeys[template.category] || Object.values(categoryImageKeys).flat();
    const imageKeys = pickRandomN(catImages, randomInt(1, Math.min(3, catImages.length)));

    // Stock
    const totalStock = randomInt(template.minStock, template.maxStock);
    const remainingStock = totalStock; // start with full stock; claims will decrement

    // Price with small variance
    const priceMult = 0.9 + Math.random() * 0.2;
    const originalPrice = Math.round(template.originalPrice * priceMult * 100) / 100;
    const subsidizedPrice = Math.round(template.subsidizedPrice * priceMult * 100) / 100;
    const isFree = Math.random() < 0.08; // 8% chance of free listing

    const listing = await prisma.foodListing.create({
      data: {
        orgId,
        title: template.title,
        description: template.description,
        category: template.category,
        totalStock,
        remainingStock,
        unit: template.unit,
        originalPrice: isFree ? 0 : originalPrice,
        subsidizedPrice: isFree ? 0 : subsidizedPrice,
        claimerType: template.claimerType,
        pickupStartAt,
        pickupEndAt,
        expiresAt,
        status: 'ACTIVE',
        imageKeys,
        videoKey: null,
        createdAt: faker.date.recent({ days: 3 }),
      },
    });

    createdListings.push({
      id: listing.id,
      title: listing.title,
      orgId: listing.orgId,
      subsidizedPrice: Number(listing.subsidizedPrice),
      unit: listing.unit,
      remainingStock: listing.remainingStock,
    });
  }

  console.log(`  ✅ ${createdListings.length} listings created\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8: Create realistic claims with working pickup OTPs
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📋 Creating claims with pickup OTPs...');

  // Known OTPs so the user can test the pickup flow
  const KNOWN_OTPS = {
    pending1: '123456',
    pending2: '234567',
    pending3: '345678',
    pending4: '456789',
    ngoPending: '567890',
    completed1: '111111',
    completed2: '222222',
    completed3: '333333',
    cancelled1: '999999',
  };

  // Get listings from primary org only (for supplier dashboard testing)
  const primaryListings = createdListings.filter((l) => l.orgId === primaryOrg.id);
  const otherListings = createdListings.filter((l) => l.orgId !== primaryOrg.id);

  const claimSummary: string[] = [];

  // --- PENDING claims by SIMPLE_RECIPIENT on primary org listings ---
  // These can be verified via the supplier dashboard's OTP input
  for (let i = 0; i < 4 && i < primaryListings.length; i++) {
    const listing = primaryListings[i]!;
    const otpKey = `pending${i + 1}` as keyof typeof KNOWN_OTPS;
    const otp = KNOWN_OTPS[otpKey] || String(100000 + i);
    const qty = randomInt(1, Math.min(3, listing.remainingStock));
    const totalPrice = qty * listing.subsidizedPrice;

    await prisma.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: recipientUser.id,
        claimerOrgId: null,
        quantity: qty,
        unitPrice: listing.subsidizedPrice,
        totalPrice,
        pickupOtpHash: hashOtp(otp),
        status: 'PENDING',
        createdAt: faker.date.recent({ days: 2 }),
      },
    });

    // Decrement stock
    await prisma.foodListing.update({
      where: { id: listing.id },
      data: { remainingStock: { decrement: qty } },
    });

    claimSummary.push(`  PENDING  | "${listing.title}" | qty=${qty} | OTP=${otp} | by ${TEST_RECIPIENT.email}`);
  }

  // --- PENDING claim by NGO on a primary org listing ---
  if (primaryListings.length > 4) {
    const listing = primaryListings[4]!;
    const otp = KNOWN_OTPS.ngoPending;
    const qty = randomInt(2, Math.min(5, listing.remainingStock));
    const totalPrice = qty * listing.subsidizedPrice;

    await prisma.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: ngoUser.id,
        claimerOrgId: ngoOrg.id,
        quantity: qty,
        unitPrice: listing.subsidizedPrice,
        totalPrice,
        pickupOtpHash: hashOtp(otp),
        status: 'PENDING',
        createdAt: faker.date.recent({ days: 1 }),
      },
    });

    await prisma.foodListing.update({
      where: { id: listing.id },
      data: { remainingStock: { decrement: qty } },
    });

    claimSummary.push(`  PENDING  | "${listing.title}" | qty=${qty} | OTP=${otp} | by ${SEED_NGO.email} (NGO)`);
  }

  // --- COMPLETED claims (already picked up) ---
  for (let i = 0; i < 3 && i + 5 < primaryListings.length; i++) {
    const listing = primaryListings[i + 5]!;
    const otpKey = `completed${i + 1}` as keyof typeof KNOWN_OTPS;
    const otp = KNOWN_OTPS[otpKey] || '000000';
    const qty = randomInt(1, Math.min(3, listing.remainingStock));
    const totalPrice = qty * listing.subsidizedPrice;

    await prisma.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: recipientUser.id,
        claimerOrgId: null,
        quantity: qty,
        unitPrice: listing.subsidizedPrice,
        totalPrice,
        pickupOtpHash: hashOtp(otp),
        status: 'COMPLETED',
        pickedUpAt: faker.date.recent({ days: 1 }),
        createdAt: faker.date.recent({ days: 2 }),
      },
    });

    await prisma.foodListing.update({
      where: { id: listing.id },
      data: { remainingStock: { decrement: qty } },
    });

    claimSummary.push(`  COMPLETED| "${listing.title}" | qty=${qty} | picked up | by ${TEST_RECIPIENT.email}`);
  }

  // --- CANCELLED claim ---
  if (primaryListings.length > 8) {
    const listing = primaryListings[8]!;
    const otp = KNOWN_OTPS.cancelled1;
    const qty = randomInt(1, 2);
    const totalPrice = qty * listing.subsidizedPrice;

    await prisma.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: recipientUser.id,
        claimerOrgId: null,
        quantity: qty,
        unitPrice: listing.subsidizedPrice,
        totalPrice,
        pickupOtpHash: hashOtp(otp),
        status: 'CANCELLED',
        cancelledAt: faker.date.recent({ days: 1 }),
        cancelReason: 'Changed plans, no longer needed',
        createdAt: faker.date.recent({ days: 3 }),
      },
    });

    // NOTE: stock NOT decremented for cancelled claims (would have been restored)
    claimSummary.push(`  CANCELLED| "${listing.title}" | qty=${qty} | by ${TEST_RECIPIENT.email}`);
  }

  // --- Claims on other vendor listings (by recipient and NGO) ---
  for (let i = 0; i < Math.min(3, otherListings.length); i++) {
    const listing = otherListings[i]!;
    const otp = String(600000 + i);
    const qty = randomInt(1, Math.min(3, listing.remainingStock));
    const totalPrice = qty * listing.subsidizedPrice;
    const isNgoClaim = i === 0; // first one is NGO

    await prisma.foodClaim.create({
      data: {
        listingId: listing.id,
        claimerId: isNgoClaim ? ngoUser.id : recipientUser.id,
        claimerOrgId: isNgoClaim ? ngoOrg.id : null,
        quantity: qty,
        unitPrice: listing.subsidizedPrice,
        totalPrice,
        pickupOtpHash: hashOtp(otp),
        status: 'PENDING',
        createdAt: faker.date.recent({ days: 2 }),
      },
    });

    await prisma.foodListing.update({
      where: { id: listing.id },
      data: { remainingStock: { decrement: qty } },
    });

    const claimer = isNgoClaim ? `${SEED_NGO.email} (NGO)` : TEST_RECIPIENT.email;
    claimSummary.push(`  PENDING  | "${listing.title}" | qty=${qty} | OTP=${otp} | by ${claimer}`);
  }

  console.log(`  ✅ ${claimSummary.length} claims created\n`);

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  const primaryCount = createdListings.filter((l) => l.orgId === primaryOrg.id).length;
  const otherCount = createdListings.length - primaryCount;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 Seed complete!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  📊 Summary:`);
  console.log(`     ${allVendorOrgIds.length} supplier orgs (verified)`);
  console.log(`     1 NGO org (verified)`);
  console.log(`     ${createdListings.length} food listings (${primaryCount} yours, ${otherCount} other vendors)`);
  console.log(`     ${claimSummary.length} claims (PENDING/COMPLETED/CANCELLED)`);
  console.log(`     ${Object.values(categoryImageKeys).flat().length} Cloudinary images`);
  console.log('');
  console.log(`  ⭐ Your account:`);
  console.log(`     Email: ${PRIMARY_USER_EMAIL}`);
  console.log(`     Org:   "${primaryOrg.name}" (${primaryOrg.id})`);
  console.log(`     ${primaryCount} listings, verified supplier`);
  console.log('');
  console.log(`  🧑 Test claimer (SIMPLE_RECIPIENT):`);
  console.log(`     Email:    ${TEST_RECIPIENT.email}`);
  console.log(`     Password: ${SEED_PASSWORD}`);
  console.log('');
  console.log(`  🏢 Test NGO claimer:`);
  console.log(`     Email:    ${SEED_NGO.email}`);
  console.log(`     Password: ${SEED_PASSWORD}`);
  console.log(`     Org:      "${SEED_NGO.orgName}" (verified)`);
  console.log('');
  console.log(`  🔑 Seed vendor accounts (password: ${SEED_PASSWORD}):`);
  for (const v of SEED_VENDORS) {
    console.log(`     ${v.email}  →  "${v.orgName}"`);
  }
  console.log('');
  console.log('  📋 Claims with known OTPs (use in supplier dashboard to verify pickup):');
  for (const line of claimSummary) {
    console.log(line);
  }
  console.log('');
  console.log('  🔐 PENDING claim OTPs for pickup verification:');
  console.log(`     Claim 1: ${KNOWN_OTPS.pending1}  (by ${TEST_RECIPIENT.email})`);
  console.log(`     Claim 2: ${KNOWN_OTPS.pending2}  (by ${TEST_RECIPIENT.email})`);
  console.log(`     Claim 3: ${KNOWN_OTPS.pending3}  (by ${TEST_RECIPIENT.email})`);
  console.log(`     Claim 4: ${KNOWN_OTPS.pending4}  (by ${TEST_RECIPIENT.email})`);
  console.log(`     NGO:     ${KNOWN_OTPS.ngoPending}  (by ${SEED_NGO.email})`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ============================================================================
// RUN
// ============================================================================

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
