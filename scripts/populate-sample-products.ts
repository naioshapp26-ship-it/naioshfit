// Populate sample scraped products for testing
// This is a temporary solution while proper scraping infrastructure is set up
// Run with: tsx scripts/populate-sample-products.ts

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('railway') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

// Sample products for each affiliate link with unique URLs
const noonProducts = [
  {
    title: 'Optimum Nutrition Gold Standard 100% Whey Protein Powder - Double Rich Chocolate 2lbs',
    price: 'AED 189.00',
    originalPrice: 'AED 249.00',
    discount: '24% OFF',
    rating: 4.5,
    reviewCount: 1250,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N53418643A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/gold-standard-100-whey-protein-powder/N53418643A/p/',
    availability: 'In Stock'
  },
  {
    title: 'MyProtein Impact Whey Protein Vanilla - 1kg',
    price: 'AED 135.00',
    originalPrice: 'AED 175.00',
    discount: '23% OFF',
    rating: 4.3,
    reviewCount: 890,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N12345678A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/myprotein-impact-whey-protein/N12345678A/p/',
    availability: 'In Stock'
  },
  {
    title: 'BSN Syntha-6 Protein Powder - Chocolate Milkshake 5lbs',
    price: 'AED 225.00',
    rating: 4.6,
    reviewCount: 670,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N98765432A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/bsn-syntha-6-protein-powder/N98765432A/p/',
    availability: 'In Stock'
  },
  {
    title: 'MuscleTech NitroTech Whey Protein Cookies & Cream - 2lbs',
    price: 'AED 159.00',
    originalPrice: 'AED 199.00',
    discount: '20% OFF',
    rating: 4.4,
    reviewCount: 550,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N45678901A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/muscletech-nitrotech-whey-protein/N45678901A/p/',
    availability: 'In Stock'
  },
  {
    title: 'Dymatize ISO100 Hydrolyzed Protein Powder Gourmet Chocolate',
    price: 'AED 245.00',
    rating: 4.7,
    reviewCount: 420,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N23456789A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/dymatize-iso100-protein/N23456789A/p/',
    availability: 'In Stock'
  },
  {
    title: 'Cellucor C4 Original Pre Workout Powder - Fruit Punch',
    price: 'AED 119.00',
    originalPrice: 'AED 149.00',
    discount: '20% OFF',
    rating: 4.6,
    reviewCount: 780,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N11223344A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/cellucor-c4-pre-workout/N11223344A/p/',
    availability: 'In Stock'
  },
  {
    title: 'Creatine Monohydrate Micronized Powder - Unflavored 300g',
    price: 'AED 79.00',
    rating: 4.8,
    reviewCount: 1120,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N55667788A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/creatine-monohydrate-powder/N55667788A/p/',
    availability: 'In Stock'
  },
  {
    title: 'BCAA Amino Acids Powder - Blue Raspberry 500g',
    price: 'AED 99.00',
    originalPrice: 'AED 129.00',
    discount: '23% OFF',
    rating: 4.4,
    reviewCount: 650,
    imageUrl: 'https://k.nooncdn.com/t_desktop-pdp-v1/v1634027277/N99887766A_1.jpg',
    productUrl: 'https://www.noon.com/uae-en/bcaa-amino-acids/N99887766A/p/',
    availability: 'In Stock'
  }
];

const amazonProducts = [
  {
    title: 'Bowflex SelectTech 552 Adjustable Dumbbells',
    price: '$299.00',
    originalPrice: '$349.99',
    discount: '15% OFF',
    rating: 4.8,
    reviewCount: 3420,
    imageUrl: 'https://m.media-amazon.com/images/I/71N4JLxVHYL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B001ARYU58',
    availability: 'In Stock'
  },
  {
    title: 'Resistance Bands Set - 5 Exercise Bands with Handles',
    price: '$29.99',
    originalPrice: '$39.99',
    discount: '25% OFF',
    rating: 4.5,
    reviewCount: 8920,
    imageUrl: 'https://m.media-amazon.com/images/I/71XqBvBxrwL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B07QGXNY2R',
    availability: 'In Stock'
  },
  {
    title: 'BalanceFrom GoYoga All-Purpose Yoga Mat - Extra Thick',
    price: '$35.99',
    rating: 4.6,
    reviewCount: 2150,
    imageUrl: 'https://m.media-amazon.com/images/I/81VYYFrQPNL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B00GN8WOQQ',
    availability: 'In Stock'
  },
  {
    title: 'Iron Gym Total Upper Body Workout Bar',
    price: '$42.50',
    originalPrice: '$55.00',
    discount: '23% OFF',
    rating: 4.4,
    reviewCount: 1680,
    imageUrl: 'https://m.media-amazon.com/images/I/71KmXDH3wGL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B001EJMS6K',
    availability: 'In Stock'
  },
  {
    title: 'TriggerPoint GRID Foam Roller for Muscle Recovery',
    price: '$19.99',
    rating: 4.7,
    reviewCount: 4520,
    imageUrl: 'https://m.media-amazon.com/images/I/71nS2YQj5xL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B0040EGNIU',
    availability: 'In Stock'
  },
  {
    title: 'AmazonBasics Vinyl Kettlebell - 10, 15, 20 Pounds',
    price: '$89.99',
    originalPrice: '$119.99',
    discount: '25% OFF',
    rating: 4.6,
    reviewCount: 1230,
    imageUrl: 'https://m.media-amazon.com/images/I/71QmH8xYEKL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B077BXYR9Y',
    availability: 'In Stock'
  },
  {
    title: 'CAP Barbell Adjustable Weighted Vest - 20-60 lbs',
    price: '$59.99',
    originalPrice: '$79.99',
    discount: '25% OFF',
    rating: 4.5,
    reviewCount: 890,
    imageUrl: 'https://m.media-amazon.com/images/I/71Qe7kJ9+QL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B00LPR7BSI',
    availability: 'In Stock'
  },
  {
    title: 'Perfect Fitness Ab Carver Pro Roller',
    price: '$34.99',
    rating: 4.4,
    reviewCount: 2340,
    imageUrl: 'https://m.media-amazon.com/images/I/71WfV7ZYMPL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B00B1VDNQA',
    availability: 'In Stock'
  },
  {
    title: 'SKLZ Pro Mini Resistance Bands Set',
    price: '$24.99',
    rating: 4.6,
    reviewCount: 1560,
    imageUrl: 'https://m.media-amazon.com/images/I/71pXOkYqpWL._AC_SL1500_.jpg',
    productUrl: 'https://www.amazon.com/dp/B00B1VDNQA',
    availability: 'In Stock'
  }
];

async function populateSampleProducts() {
  try {
    console.log('\n🔧 Populating sample scraped products...\n');
    
    // Get affiliate products
    const affiliateProds = await pool.query('SELECT id, url, source FROM affiliate_products ORDER BY id');
    
    console.log(`📋 Found ${affiliateProds.rows.length} affiliate products\n`);
    
    let totalInserted = 0;
    let noonIndex = 0;
    let amazonIndex = 0;
    
    for (const affProd of affiliateProds.rows) {
      console.log(`Processing affiliate product #${affProd.id} (${affProd.source})...`);
      
      // Clear existing scraped products for this affiliate product
      await pool.query('DELETE FROM scraped_affiliate_products WHERE affiliate_product_id = $1', [affProd.id]);
      
      // Determine which sample products to use and rotate through them
      let products: Array<{
        title: string;
        price: string;
        originalPrice?: string;
        discount?: string;
        rating: number;
        reviewCount: number;
        imageUrl: string;
        productUrl: string;
        availability: string;
      }> = [];
      
      if (affProd.source === 'noon') {
        // Get 3-4 unique products for each Noon affiliate link, rotating through the array
        const numProducts = 3 + (noonIndex % 2); // Alternates between 3 and 4 products
        for (let i = 0; i < numProducts && i < noonProducts.length; i++) {
          const productIndex = (noonIndex + i) % noonProducts.length;
          products.push(noonProducts[productIndex]);
        }
        noonIndex += numProducts;
      } else if (affProd.source === 'amazon') {
        // Get 3-4 unique products for each Amazon affiliate link, rotating through the array
        const numProducts = 3 + (amazonIndex % 2); // Alternates between 3 and 4 products
        for (let i = 0; i < numProducts && i < amazonProducts.length; i++) {
          const productIndex = (amazonIndex + i) % amazonProducts.length;
          products.push(amazonProducts[productIndex]);
        }
        amazonIndex += numProducts;
      }
      
      // Insert sample products
      for (const product of products) {
        await pool.query(`
          INSERT INTO scraped_affiliate_products 
          (affiliate_product_id, title, price, original_price, discount, rating, review_count, image_url, product_url, availability)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          affProd.id,
          product.title,
          product.price,
          product.originalPrice || null,
          product.discount || null,
          product.rating,
          product.reviewCount,
          product.imageUrl,
          product.productUrl,  // Now using the actual product URL instead of category URL
          product.availability
        ]);
        
        totalInserted++;
      }
      
      console.log(`  ✅ Inserted ${products.length} unique products`);
      
      // Update last_scraped_at
      await pool.query('UPDATE affiliate_products SET last_scraped_at = NOW() WHERE id = $1', [affProd.id]);
    }
    
    console.log(`\n✅ Successfully populated ${totalInserted} sample products!`);
    
    // Show summary
    const summary = await pool.query(`
      SELECT 
        ap.source,
        COUNT(sap.id) as product_count
      FROM affiliate_products ap
      LEFT JOIN scraped_affiliate_products sap ON ap.id = sap.affiliate_product_id
      GROUP BY ap.source
      ORDER BY ap.source
    `);
    
    console.log('\n📊 Summary by source:');
    summary.rows.forEach(row => {
      console.log(`  ${row.source}: ${row.product_count} products`);
    });
    
  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

populateSampleProducts();
