// prisma/seed.cjs
const SKIP_IF_EXISTS = process.argv.includes('--skip-existing');

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function seasonalFactor(month) {
  if (month >= 3 && month <= 5) return 0.9;
  if (month >= 10 && month <= 12) return 1.15;
  return 1.0;
}

// ─────────────────────────────────────────────────────────────
// Seed Data Configuration
// ─────────────────────────────────────────────────────────────
const cropData = [
  { name: 'Maize', category: 'Cereal', unit: '50kg bag', basePrice: 320 },
  { name: 'Soya Beans', category: 'Legume', unit: '50kg bag', basePrice: 420 },
  { name: 'Groundnuts', category: 'Legume', unit: '50kg bag', basePrice: 450 },
  { name: 'Rice', category: 'Cereal', unit: '50kg bag', basePrice: 500 },
  { name: 'Cassava', category: 'Root', unit: '50kg bag', basePrice: 280 },
];

const marketData = [
  { name: 'Lusaka', province: 'Lusaka', district: 'Lusaka', factor: 1.1 },
  { name: 'Ndola', province: 'Copperbelt', district: 'Ndola', factor: 1.05 },
  { name: 'Kitwe', province: 'Copperbelt', district: 'Kitwe', factor: 1.03 },
  { name: 'Chipata', province: 'Eastern', district: 'Chipata', factor: 0.95 },
  { name: 'Livingstone', province: 'Southern', district: 'Livingstone', factor: 1.0 },
];

// ─────────────────────────────────────────────────────────────
// Main Seed Function
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🌾 Seeding Zambia Agricultural Hub Dataset...');

  try {
    // 1️⃣ Seed Crops
    for (const crop of cropData) {
      await prisma.crop.upsert({
        where: { name: crop.name },
        update: {},
        create: { name: crop.name, category: crop.category, unit: crop.unit },
      });
    }
    console.log(`✅ Seeded ${cropData.length} crops`);

    // 2️⃣ Seed Markets
    for (const market of marketData) {
      await prisma.market.upsert({
        where: { name: market.name },
        update: {},
        create: { name: market.name, province: market.province, district: market.district },
      });
    }
    console.log(`✅ Seeded ${marketData.length} markets`);

    // 3️⃣ Create Admin User
    const adminPassword = await bcrypt.hash('Admin@123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@agrihub.com' },
      update: {},
      create: {
        fullName: 'System Admin',
        email: 'admin@agrihub.com',
        password: adminPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('✅ Created admin user');

    const allCrops = await prisma.crop.findMany();
    const allMarkets = await prisma.market.findMany();

    // 5️⃣ Generate 180 days of historical prices (OPTIMIZED)
    console.log('📊 Generating 180 days of historical prices...');
    
    for (let d = 180; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);
      const month = date.getMonth() + 1;

      for (const crop of allCrops) {
        const cropConfig = cropData.find((c) => c.name === crop.name);
        if (!cropConfig) continue;
        const base = cropConfig.basePrice;

        for (const market of allMarkets) {
          const marketConfig = marketData.find((m) => m.name === market.name);
          if (!marketConfig) continue;
          const factor = marketConfig.factor;

          const price = Math.round(
            base * seasonalFactor(month) * factor + randomBetween(-20, 20)
          );

          // ✅ OPTIMIZATION: Skip if record exists and flag is set
          if (SKIP_IF_EXISTS) {
            const exists = await prisma.dailyPrice.findUnique({
              where: {
                cropId_marketId_priceDate: {
                  cropId: crop.id,
                  marketId: market.id,
                  priceDate: date,
                },
              },
              select: { id: true }
            });
            if (exists) continue;
          }

          await prisma.dailyPrice.upsert({
            where: {
              cropId_marketId_priceDate: {
                cropId: crop.id,
                marketId: market.id,
                priceDate: date,
              },
            },
            update: { price },
            create: {
              cropId: crop.id,
              marketId: market.id,
              price,
              priceDate: date,
              createdBy: admin.id,
            },
          });
        }
      }
    }
    console.log('✅ Generated 180 days of price data');

    // 6️⃣ Generate Predictions
    console.log('🤖 Generating 7-day price predictions...');
    for (const crop of allCrops) {
      for (const market of allMarkets) {
        const recentPrices = await prisma.dailyPrice.findMany({
          where: { cropId: crop.id, marketId: market.id },
          orderBy: { priceDate: 'desc' },
          take: 30,
        });

        if (recentPrices.length < 7) continue;

        const avg = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
        const lastPriceDate = recentPrices[0]?.priceDate || new Date();

        for (let i = 1; i <= 7; i++) {
          const trend = 1 + i * 0.015;
          const noise = randomBetween(-10, 10);
          const predictedPrice = Math.round(avg * trend + noise);

          const predictionDate = new Date(lastPriceDate);
          predictionDate.setDate(predictionDate.getDate() + i);
          predictionDate.setHours(0, 0, 0, 0);

          await prisma.prediction.upsert({
            where: {
              crop_market_prediction_unique: {
                cropId: crop.id,
                marketId: market.id,
                predictionDate: predictionDate,
              },
            },
            update: { predictedPrice },
            create: {
              cropId: crop.id,
              marketId: market.id,
              predictedPrice,
              basedOnDays: 30,
              predictionDate,
            },
          });
        }
      }
    }
    console.log('✅ Generated predictions for all crop-market pairs');

    // 7️⃣ Create Test Farmer Users
    const farmer1 = await prisma.user.upsert({
      where: { email: 'farmer1@agrihub.com' },
      update: {},
      create: {
        fullName: 'John Farmer',
        email: 'farmer1@agrihub.com',
        password: await bcrypt.hash('password123', 10),
        role: 'FARMER',
        isActive: true,
      },
    });

    const farmer2 = await prisma.user.upsert({
      where: { email: 'farmer2@agrihub.com' },
      update: {},
      create: {
        fullName: 'Mary Farmer',
        email: 'farmer2@agrihub.com',
        password: await bcrypt.hash('password123', 10),
        role: 'FARMER',
        isActive: true,
      },
    });
    console.log('✅ Created 2 test farmer accounts');

    // 8️⃣ Create Sample Price Alerts
    await prisma.priceAlert.upsert({
      where: {
        userId_cropId_marketId: {
          userId: farmer1.id,
          cropId: allCrops[0].id,
          marketId: allMarkets[0].id,
        },
      },
      update: { targetPrice: 450 },
      create: {
        userId: farmer1.id,
        cropId: allCrops[0].id,
        marketId: allMarkets[0].id,
        targetPrice: 450,
        isActive: true,
      },
    });

    await prisma.priceAlert.upsert({
      where: {
        userId_cropId_marketId: {
          userId: farmer2.id,
          cropId: allCrops[1].id,
          marketId: allMarkets[1].id,
        },
      },
      update: { targetPrice: 480 },
      create: {
        userId: farmer2.id,
        cropId: allCrops[1].id,
        marketId: allMarkets[1].id,
        targetPrice: 480,
        isActive: true,
      },
    });
    console.log('✅ Created sample price alerts');

    // 9️⃣ Seed SMS Queue
    const smsData = [
      { phoneNumber: '+260971000001', message: 'Maize price reached your target in Lusaka.' },
      { phoneNumber: '+260972000002', message: 'Soya beans price rising in Ndola.' },
    ];

    for (const sms of smsData) {
      try {
        await prisma.smsQueue.create({ data: sms });
      } catch (e) {
        console.log('⚠️ Duplicate SMS skipped:', sms.phoneNumber);
      }
    }
    console.log('✅ Seeded SMS queue');

    // 🔟 Register Farmers
    await prisma.farmerRegistration.upsert({
      where: { phoneNumber: '+260971000001' },
      update: {},
      create: { phoneNumber: '+260971000001', fullName: 'John Farmer', channel: 'ussd', userId: farmer1.id },
    });
    await prisma.farmerRegistration.upsert({
      where: { phoneNumber: '+260972000002' },
      update: {},
      create: { phoneNumber: '+260972000002', fullName: 'Mary Farmer', channel: 'sms', userId: farmer2.id },
    });
    console.log('✅ Registered farmers with channel data');

    // 1️⃣1️⃣ Log Seed Activities ✅ FIXED SYNTAX
       // 1️⃣1️⃣ Log Seed Activities ✅ FIXED SYNTAX
    const activities = [
      { type: 'SYSTEM', description: 'Agricultural dataset initialized', userId: admin.id, status: 'SUCCESS' },
      { type: 'DATASET', description: '180 days crop price data generated', userId: admin.id, status: 'SUCCESS' },
      { type: 'PREDICTION', description: '7-day price predictions generated for all pairs', userId: admin.id, status: 'SUCCESS' },
      { type: 'SMS', description: 'SMS notifications queued for farmers', userId: admin.id, status: 'SUCCESS' },
    ];

    for (const activity of activities) {
      // ✅✅✅ CRITICAL: "data:" key is REQUIRED ✅✅✅
      await prisma.activity.create({
        data: {  // ← ✅✅✅ THIS IS THE FIX: "data:" + colon + space + {
          ...activity,
          metadata: JSON.stringify({ seededAt: new Date().toISOString() })
        }
      });
    }
    console.log('✅ Logged seed activities');

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n🔑 Test Credentials:');
    console.log('  Admin:   admin@agrihub.com / Admin@123');
    console.log('  Farmer1: farmer1@agrihub.com / password123');
    console.log('  Farmer2: farmer2@agrihub.com / password123');
    console.log('\n📱 USSD Test Numbers:');
    console.log('  +260971000001 (John)');
    console.log('  +260972000002 (Mary)');

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Seed
// ─────────────────────────────────────────────────────────────
main()
  .catch((e) => {
    console.error('❌ Unhandled seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });