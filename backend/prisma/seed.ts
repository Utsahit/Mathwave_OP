import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Hash Passwords ──
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ── Seed Roles ──
  const adminRole = await prisma.dbRole.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator with full access rights.'
    }
  });

  const managerRole = await prisma.dbRole.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Store Manager supervising operations, inventory, and menu.'
    }
  });

  const staffRole = await prisma.dbRole.upsert({
    where: { name: 'STAFF' },
    update: {},
    create: {
      name: 'STAFF',
      description: 'Restaurant Staff managing orders and reservations.'
    }
  });

  const customerRole = await prisma.dbRole.upsert({
    where: { name: 'CUSTOMER' },
    update: {},
    create: {
      name: 'CUSTOMER',
      description: 'Restaurant Guest customers.'
    }
  });

  // ── Seed Permissions ──
  const permissionsList = [
    { name: 'manage:menu', description: 'Can add, edit, or delete menu items and categories.' },
    { name: 'manage:orders', description: 'Can manage order statuses and workflow states.' },
    { name: 'manage:reservations', description: 'Can confirm or cancel reservation requests.' },
    { name: 'manage:users', description: 'Can update user profiles and edit system roles.' },
    { name: 'manage:inventory', description: 'Can update raw materials inventory and suppliers logs.' },
    { name: 'manage:settings', description: 'Can update restaurant metadata settings and toggle feature flags.' },
    { name: 'read:analytics', description: 'Can access analytical dashboards.' },
    // Phase 6 — granular table & reservation permissions
    { name: 'table:create', description: 'Can create new restaurant tables.' },
    { name: 'table:update', description: 'Can update existing restaurant table details.' },
    { name: 'table:delete', description: 'Can soft-delete restaurant tables.' },
    { name: 'reservation:view', description: 'Can view all reservations in the admin panel.' },
    { name: 'reservation:update', description: 'Can update reservation details and status.' },
    { name: 'reservation:delete', description: 'Can cancel or delete reservations.' },
    // Phase 7 — review permissions
    { name: 'review:approve', description: 'Can approve or reject reviews.' },
    { name: 'review:feature', description: 'Can feature or unfeature reviews.' },
    { name: 'review:delete', description: 'Can delete reviews.' },
    { name: 'review:view', description: 'Can view admin list of reviews.' },
    { name: 'review:stats', description: 'Can view admin stats of reviews.' },
    // Phase 8 — contact & newsletter permissions
    { name: 'contact:view', description: 'Can view customer contact messages and inbox.' },
    { name: 'contact:update', description: 'Can update/mark contact messages read status.' },
    { name: 'contact:delete', description: 'Can soft delete contact messages.' },
    // Phase 9 — order & payment permissions
    { name: 'order:view', description: 'Can view orders.' },
    { name: 'order:update', description: 'Can update order status.' },
    { name: 'order:cancel', description: 'Can cancel orders.' },
    { name: 'order:create', description: 'Can create orders.' },
    { name: 'payment:view', description: 'Can view payment status.' },
    { name: 'payment:verify', description: 'Can verify payments.' },
    // Phase 10 — inventory & supplier permissions
    { name: 'ingredient:view', description: 'Can view ingredients.' },
    { name: 'ingredient:create', description: 'Can create ingredients.' },
    { name: 'ingredient:update', description: 'Can update ingredients.' },
    { name: 'ingredient:delete', description: 'Can delete ingredients.' },
    { name: 'supplier:view', description: 'Can view suppliers.' },
    { name: 'supplier:create', description: 'Can create suppliers.' },
    { name: 'supplier:update', description: 'Can update suppliers.' },
    { name: 'supplier:delete', description: 'Can delete suppliers.' },
    { name: 'purchase:view', description: 'Can view purchase orders.' },
    { name: 'purchase:create', description: 'Can create purchase orders.' },
    { name: 'purchase:update', description: 'Can update purchase orders.' },
    // Phase 11 — kitchen & analytics permissions
    { name: 'kitchen:view', description: 'Can view kitchen tickets.' },
    { name: 'kitchen:update', description: 'Can update kitchen ticket status.' },
    { name: 'kitchen:assign', description: 'Can assign tickets to stations.' },
    { name: 'analytics:view', description: 'Can view dashboard analytics.' },
    // Phase 12 — notifications, audit, job permissions
    { name: 'notification:view', description: 'Can view notifications.' },
    { name: 'notification:update', description: 'Can mark notifications as read.' },
    { name: 'audit:view', description: 'Can view audit logs.' },
    { name: 'job:view', description: 'Can view job queue.' },
    { name: 'job:retry', description: 'Can retry failed jobs.' },
    // Phase 13B — loyalty, coupon, giftcard, referral permissions
    { name: 'loyalty:view', description: 'Can view loyalty points and history.' },
    { name: 'loyalty:update', description: 'Can adjust loyalty points.' },
    { name: 'coupon:view', description: 'Can view coupons.' },
    { name: 'coupon:create', description: 'Can create coupons.' },
    { name: 'coupon:update', description: 'Can update coupons.' },
    { name: 'coupon:delete', description: 'Can delete coupons.' },
    { name: 'giftcard:view', description: 'Can view gift cards.' },
    { name: 'giftcard:create', description: 'Can create gift cards.' },
    { name: 'giftcard:update', description: 'Can update gift cards.' },
    { name: 'giftcard:delete', description: 'Can delete gift cards.' },
    // Phase 14 — branch, franchise, transfer permissions
    { name: 'branch:view', description: 'Can view branches.' },
    { name: 'branch:create', description: 'Can create branches.' },
    { name: 'branch:update', description: 'Can update branches.' },
    { name: 'branch:delete', description: 'Can delete branches.' },
    { name: 'franchise:view', description: 'Can view franchises.' },
    { name: 'franchise:create', description: 'Can create franchises.' },
    { name: 'franchise:update', description: 'Can update franchises.' },
    { name: 'branch:analytics', description: 'Can view branch analytics.' },
    { name: 'branch:inventory', description: 'Can manage branch inventory.' },
    { name: 'branch:staff', description: 'Can manage branch staff.' },
    { name: 'transfer:view', description: 'Can view inventory transfers.' },
    { name: 'transfer:create', description: 'Can create inventory transfers.' },
    { name: 'transfer:approve', description: 'Can approve inventory transfers.' },
    // Phase 15 — BI & Reporting permissions
    { name: 'analytics:executive', description: 'Can view executive dashboard.' },
    { name: 'analytics:forecast', description: 'Can view forecast analytics.' },
    { name: 'analytics:export', description: 'Can export analytics reports.' },
    { name: 'report:view', description: 'Can view scheduled reports.' },
    { name: 'report:create', description: 'Can create scheduled reports.' },
    { name: 'report:delete', description: 'Can delete scheduled reports.' },
    // Phase 16 — Customer Self-Service & Omnichannel
    { name: 'support:view', description: 'Can view support tickets.' },
    { name: 'support:update', description: 'Can update support ticket status.' },
    // Phase 17 — Marketing Automation, CRM & Customer Engagement
    { name: 'campaign:view', description: 'Can view marketing campaigns.' },
    { name: 'campaign:create', description: 'Can create marketing campaigns.' },
    { name: 'campaign:update', description: 'Can update marketing campaigns.' },
    { name: 'campaign:delete', description: 'Can delete marketing campaigns.' },
    { name: 'segment:view', description: 'Can view customer segments.' },
    { name: 'segment:update', description: 'Can recalculate customer segments.' },
    { name: 'marketing:view', description: 'Can view marketing automations.' },
    { name: 'marketing:update', description: 'Can update marketing automations.' },
    // Phase 18 — Security, Compliance & Penetration Testing
    { name: 'security:view', description: 'Can view security dashboard.' },
    { name: 'security:audit', description: 'Can perform security audits.' },
  ];

  const dbPermissions: { [key: string]: any } = {};

  for (const perm of permissionsList) {
    dbPermissions[perm.name] = await prisma.dbPermission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm
    });
  }

  // ── Seed Role-Permissions mappings ──
  const rolePermissionsMap: { [key: string]: string[] } = {
    ADMIN: [
      'manage:menu', 'manage:orders', 'manage:reservations', 'manage:users',
      'manage:inventory', 'manage:settings', 'read:analytics',
      'table:create', 'table:update', 'table:delete',
      'reservation:view', 'reservation:update', 'reservation:delete',
      'review:approve', 'review:feature', 'review:delete', 'review:view', 'review:stats',
      'contact:view', 'contact:update', 'contact:delete',
      'order:view', 'order:update', 'order:cancel', 'order:create', 'payment:view', 'payment:verify',
      'ingredient:view', 'ingredient:create', 'ingredient:update', 'ingredient:delete',
      'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
      'purchase:view', 'purchase:create', 'purchase:update',
      'kitchen:view', 'kitchen:update', 'kitchen:assign', 'analytics:view',
      'notification:view', 'notification:update', 'audit:view', 'job:view', 'job:retry',
      'loyalty:view', 'loyalty:update',
      'coupon:view', 'coupon:create', 'coupon:update', 'coupon:delete',
      'giftcard:view', 'giftcard:create', 'giftcard:update', 'giftcard:delete',
      'branch:view', 'branch:create', 'branch:update', 'branch:delete',
      'franchise:view', 'franchise:create', 'franchise:update',
      'branch:analytics', 'branch:inventory', 'branch:staff',
      'transfer:view', 'transfer:create', 'transfer:approve',
      // Phase 15 — BI & Reporting
      'analytics:executive', 'analytics:forecast', 'analytics:export',
      'report:view', 'report:create', 'report:delete',
      // Phase 16 — Customer Self-Service
      'support:view', 'support:update',
      // Phase 17 — Marketing Automation & CRM
      'campaign:view', 'campaign:create', 'campaign:update', 'campaign:delete',
      'segment:view', 'segment:update',
      'marketing:view', 'marketing:update',
      // Phase 18 — Security & Compliance
      'security:view', 'security:audit',
    ],
    MANAGER: [
      'manage:menu', 'manage:orders', 'manage:reservations', 'manage:inventory', 'read:analytics',
      'table:create', 'table:update', 'table:delete',
      'reservation:view', 'reservation:update', 'reservation:delete',
      'review:approve', 'review:feature', 'review:view', 'review:stats',
      'contact:view', 'contact:update',
      'order:view', 'order:update', 'payment:view',
      'ingredient:view', 'ingredient:create', 'ingredient:update',
      'supplier:view', 'supplier:create', 'supplier:update',
      'purchase:view', 'purchase:create', 'purchase:update',
      'notification:view', 'notification:update', 'audit:view', 'job:view',
      'loyalty:view',
      'coupon:view', 'coupon:create', 'coupon:update',
      'giftcard:view',
      'branch:view', 'branch:update', 'branch:analytics', 'branch:inventory',
      'transfer:view', 'transfer:create', 'transfer:approve',
      // Phase 15 — BI & Reporting (read-only)
      'analytics:executive', 'analytics:forecast', 'analytics:export',
      'report:view',
      // Phase 18 — Security & Compliance (read-only)
      'security:view',
    ],
    STAFF: [
      'manage:orders', 'manage:reservations',
      'reservation:view', 'reservation:update',
      'review:view',
      'order:view', 'order:update',
      'ingredient:view', 'supplier:view', 'purchase:view',
      'kitchen:view', 'kitchen:update',
      'notification:view',
      'loyalty:view',
      'branch:view',
      // Phase 17 — Marketing (read-only)
      'marketing:view',
    ],
    CUSTOMER: [
      'order:create',
    ],
  };

  for (const [roleName, perms] of Object.entries(rolePermissionsMap)) {
    const role =
      roleName === 'ADMIN'
        ? adminRole
        : roleName === 'MANAGER'
          ? managerRole
          : roleName === 'STAFF'
            ? staffRole
            : customerRole;
    for (const permName of perms) {
      const permission = dbPermissions[permName];
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  // ── Seed Users ──
  await prisma.user.upsert({
    where: { email: 'admin@elixirandoak.in' },
    update: {},
    create: {
      email: 'admin@elixirandoak.in',
      passwordHash: passwordHash,
      name: 'System Admin',
      roleId: adminRole.id
    }
  });

  await prisma.user.upsert({
    where: { email: 'staff@elixirandoak.in' },
    update: {},
    create: {
      email: 'staff@elixirandoak.in',
      passwordHash: passwordHash,
      name: 'Rohan Mehta',
      roleId: staffRole.id
    }
  });

  await prisma.user.upsert({
    where: { email: 'customer@elixirandoak.in' },
    update: {},
    create: {
      email: 'customer@elixirandoak.in',
      passwordHash: passwordHash,
      name: 'Jane Doe',
      roleId: customerRole.id
    }
  });

  // ── Seed Tables ──
  const tables = [
    { number: 'T1', capacity: 2 },
    { number: 'T2', capacity: 2 },
    { number: 'T3', capacity: 4 },
    { number: 'T4', capacity: 4 },
    { number: 'T5', capacity: 6 },
    { number: 'T6', capacity: 8 }
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: { number: t.number },
      update: {},
      create: { ...t, isActive: true }
    });
  }

  // ── Seed Menu Categories ──
  const categoriesList = [
    { name: 'Coffees', slug: 'coffees', description: 'Artisanal single-origin brews and specialty espresso extractions.' },
    { name: 'Food', slug: 'food', description: 'Gourmet plates combining molecular gastronomy with heirloom Indian ingredients.' },
    { name: 'Desserts', slug: 'desserts', description: 'Delectable botanically-infused sweet treats.' },
    { name: 'Elixirs', slug: 'elixirs', description: 'House-fermented sodas, botanical cocktails, and zero-proof spritzes.' }
  ];

  const dbCategories: { [key: string]: any } = {};

  for (const cat of categoriesList) {
    dbCategories[cat.slug] = await prisma.menuCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat
    });
  }

  // ── Seed Menu Items (Matching hardcoded menu.json exactly) ──
  const menuItems = [
    {
      name: 'Malabar Cold Brew',
      slug: 'malabar-cold-brew',
      description: 'House-steeped 18 hrs with cardamom and dark chocolate.',
      price: 450.00,
      image: 'cbc.webp',
      tag: 'SIGNATURE',
      isFeatured: true,
      categorySlug: 'coffees'
    },
    {
      name: 'Yirgacheffe Pour Over',
      slug: 'yirgacheffe-pour-over',
      description: 'Jasmine, lemongrass, and white peach. Single origin Ethiopia.',
      price: 550.00,
      image: 'perfect-crema-2-scaled.webp',
      tag: 'SINGLE ORIGIN',
      isFeatured: false,
      categorySlug: 'coffees'
    },
    {
      name: 'Saffron Cortado',
      slug: 'saffron-cortado',
      description: 'Double shot espresso, Kashmiri saffron steamed milk, rose water mist.',
      price: 480.00,
      image: 'rose_cardamom_cold_brew_diaspora.webp',
      tag: 'HOUSE SPECIAL',
      isFeatured: true,
      categorySlug: 'coffees'
    },
    {
      name: 'Bombay Brioche',
      slug: 'bombay-brioche',
      description: 'Masala-spiced berry compote, clotted cream, gold leaf.',
      price: 850.00,
      image: 'avocad_tost.webp',
      tag: 'BESTSELLER',
      isFeatured: true,
      categorySlug: 'food'
    },
    {
      name: 'Saffron Risotto',
      slug: 'saffron-risotto',
      description: 'Kashmiri saffron, toasted pine nuts, local artisanal parmesan.',
      price: 1250.00,
      image: 'Mediterranean-Rice-Featured-Image-scaled.webp',
      isFeatured: false,
      categorySlug: 'food'
    },
    {
      name: 'Truffle Brioche Toast',
      slug: 'truffle-brioche-toast',
      description: 'Cultured butter, local honey, shaved black truffle from Uttarakhand.',
      price: 980.00,
      image: 'images.webp',
      isFeatured: false,
      categorySlug: 'food'
    },
    {
      name: 'Cacao & Sea Salt',
      slug: 'cacao-sea-salt',
      description: '72% dark single-origin mousse, Alibaug sea salt caramel.',
      price: 650.00,
      image: 'chocolate_mousse.webp',
      tag: 'SIGNATURE',
      isFeatured: true,
      categorySlug: 'desserts'
    },
    {
      name: 'Gulab Crème Brûlée',
      slug: 'gulab-creme-brulee',
      description: 'Classic custard infused with gulab jal, torched to order.',
      price: 580.00,
      image: 'custard.webp',
      isFeatured: false,
      categorySlug: 'desserts'
    },
    {
      name: 'Cardamom Mille-Feuille',
      slug: 'cardamom-mille-feuille',
      description: 'Flaky laminated pastry, elaichi-scented cream, saffron glaze.',
      price: 720.00,
      image: 'Gemini_Generated_Image_z548a7z548a7z548.png',
      isFeatured: false,
      categorySlug: 'desserts'
    },
    {
      name: 'Oak Botanical Gin',
      slug: 'oak-botanical-gin',
      description: 'House-infused gin with coastal botanicals, tonic, cucumber ribbon.',
      price: 950.00,
      image: 'cbc.webp',
      tag: 'AFTER 6PM',
      isFeatured: false,
      categorySlug: 'elixirs'
    },
    {
      name: 'Negroni Mumbai',
      slug: 'negroni-mumbai',
      description: 'Campari, aged vermouth, local craft gin, orange bitters.',
      price: 1100.00,
      image: 'cbc.webp',
      tag: 'AFTER 6PM',
      isFeatured: false,
      categorySlug: 'elixirs'
    },
    {
      name: 'Rose Lassi Spritz',
      slug: 'rose-lassi-spritz',
      description: 'Chilled lassi, rose syrup, Malabar pepper, kombucha fizz.',
      price: 380.00,
      image: 'cbc.webp',
      tag: 'ZERO PROOF',
      isFeatured: false,
      categorySlug: 'elixirs'
    }
  ];

  for (const item of menuItems) {
    const category = dbCategories[item.categorySlug];
    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        price: item.price,
        image: item.image,
        tag: item.tag,
        isFeatured: item.isFeatured,
        categoryId: category.id
      }
    });
  }

  // ── Seed Business Settings ──
  const settingsList = [
    { key: 'site_name', value: 'ELIXIR & OAK' },
    { key: 'site_tagline', value: 'Artisanal Brewery & Gastronomy' },
    { key: 'phone_number', value: '+91 98200 00000' },
    { key: 'contact_email', value: 'hello@elixirandoak.in' },
    { key: 'address', value: 'Colaba Causeway, Colaba, Mumbai, Maharashtra 400005' },
    { key: 'operating_hours', value: 'Mon-Sun: 8:00 AM - 11:00 PM' }
  ];

  for (const setting of settingsList) {
    await prisma.businessSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }

  // ── Seed Feature Flags ──
  const flagsList = [
    { name: 'enable_payments', description: 'Enable Razorpay checkout portal integrations.', enabled: true },
    { name: 'enable_reservations', description: 'Enable slot reservations table bookings.', enabled: true },
    { name: 'enable_inventory', description: 'Enable automated ingredients inventory tracking.', enabled: true },
    { name: 'enable_loyalty', description: 'Enable customer loyalty rewards program modules.', enabled: false }
  ];

  for (const flag of flagsList) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: {},
      create: flag
    });
  }

  // ── Seed Kitchen Stations ──
  const kitchenStations = [
    { name: 'Main Line', description: 'Main cooking station for all orders' },
    { name: 'Grill', description: 'Grill and charbroil items' },
    { name: 'Salad', description: 'Cold prep and salads' },
    { name: 'Dessert', description: 'Desserts and pastry station' },
    { name: 'Beverage', description: 'Drinks and beverages' },
  ];

  for (const station of kitchenStations) {
    await prisma.kitchenStation.upsert({
      where: { name: station.name },
      update: {},
      create: station,
    });
  }

  // ── Seed Initial Reviews ──
  const reviewsList = [
    {
      name: 'ARJUN MEHRA',
      rating: 5,
      comment: 'An ethereal sanctuary amidst the Colaba bustle. The Malabar Cold Brew is quite simply the finest extraction I have tasted in Mumbai.',
      isApproved: true
    },
    {
      name: 'PRIYA SHARMA',
      rating: 5,
      comment: 'The Bombay Brioche is a masterpiece of textures. The pairing of local artisanal cream with gold leaf creates a ritual of true luxury.',
      isApproved: true
    },
    {
      name: 'DAVID CHEN',
      rating: 5,
      comment: 'Rare to find a space that understands silence as much as it understands service. The attention to detail in every pour is remarkable.',
      isApproved: true
    }
  ];

  for (const review of reviewsList) {
    await prisma.review.create({
      data: review
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
