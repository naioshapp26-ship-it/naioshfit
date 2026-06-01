import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { affiliateProducts, scrapedAffiliateProducts } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface ScrapedProduct {
  title: string;
  price?: string;
  originalPrice?: string;
  discount?: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  productUrl: string;
  availability?: string;
}

/**
 * Scrape products from a Noon category URL
 */
async function scrapeNoonProducts(url: string): Promise<ScrapedProduct[]> {
  try {
    console.log(`🔍 Scraping Noon URL: ${url}`);
    
    // First, we need to resolve the short URL to get the actual category page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const products: ScrapedProduct[] = [];

    // Noon product selectors (limit to 10 products per URL)
    const productElements = $('[data-qa="product-box"], .productContainer, .product-item, [class*="ProductBox"]').slice(0, 10);
    
    console.log(`📦 Found ${productElements.length} product elements on Noon`);

    productElements.each((index, element) => {
      try {
        const $el = $(element);
        
        // Extract product data with multiple selector fallbacks
        const title = $el.find('[data-qa="product-name"], .productTitle, h2, h3, [class*="productName"]').first().text().trim()
          || $el.find('a[title]').attr('title')?.trim()
          || '';
        
        const priceText = $el.find('[data-qa="product-price"], .price, [class*="price"], .amount').first().text().trim();
        const originalPriceText = $el.find('[data-qa="product-original-price"], .oldPrice, [class*="originalPrice"]').first().text().trim();
        
        const imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        
        const productLink = $el.find('a').first().attr('href');
        const productUrl = productLink 
          ? (productLink.startsWith('http') ? productLink : `https://www.noon.com${productLink}`)
          : '';

        const ratingText = $el.find('[data-qa="product-rating"], .rating, [class*="rating"]').first().text().trim();
        const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0] || '0') : undefined;

        const reviewText = $el.find('[data-qa="product-reviews"], .reviews, [class*="review"]').first().text().trim();
        const reviewCount = reviewText ? parseInt(reviewText.match(/\d+/)?.[0] || '0') : undefined;

        if (title && productUrl) {
          products.push({
            title,
            price: priceText || undefined,
            originalPrice: originalPriceText || undefined,
            rating,
            reviewCount,
            imageUrl,
            productUrl,
            availability: 'In Stock',
          });
        }
      } catch (err) {
        console.error(`Error parsing Noon product at index ${index}:`, err);
      }
    });

    // If no products found with standard selectors, try alternative approach
    if (products.length === 0) {
      console.log('⚠️ No products found with standard selectors, trying alternative approach...');
      
      // Look for any links that might be product links (limit to 10)
      $('a[href*="/p/"], a[href*="/product/"]').slice(0, 10).each((index, element) => {
        const $el = $(element);
        const title = $el.text().trim() || $el.attr('title')?.trim() || `Product ${index + 1}`;
        const href = $el.attr('href');
        const productUrl = href 
          ? (href.startsWith('http') ? href : `https://www.noon.com${href}`)
          : '';
        
        const img = $el.find('img').first();
        const imageUrl = img.attr('src') || img.attr('data-src');

        if (title && productUrl && !products.find(p => p.productUrl === productUrl)) {
          products.push({
            title,
            imageUrl,
            productUrl,
            availability: 'In Stock',
          });
        }
      });
    }

    console.log(`✅ Scraped ${products.length} products from Noon`);
    return products;

  } catch (error: any) {
    console.error('❌ Error scraping Noon products:', error.message);
    return [];
  }
}

/**
 * Scrape products from an Amazon affiliate URL
 */
async function scrapeAmazonProducts(url: string): Promise<ScrapedProduct[]> {
  try {
    console.log(`🔍 Scraping Amazon URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const products: ScrapedProduct[] = [];

    // Amazon product selectors (limit to 10 products per URL)
    const productElements = $('[data-component-type="s-search-result"], .s-result-item, [data-asin]').slice(0, 10);
    
    console.log(`📦 Found ${productElements.length} product elements on Amazon`);

    productElements.each((index, element) => {
      try {
        const $el = $(element);
        const asin = $el.attr('data-asin');
        
        if (!asin) return;

        const title = $el.find('h2 a span, .a-size-base-plus, .a-size-medium').first().text().trim();
        
        const priceWhole = $el.find('.a-price-whole').first().text().trim();
        const priceFraction = $el.find('.a-price-fraction').first().text().trim();
        const priceSymbol = $el.find('.a-price-symbol').first().text().trim();
        const price = priceWhole ? `${priceSymbol}${priceWhole}${priceFraction}` : undefined;

        const imageUrl = $el.find('.s-image, img').first().attr('src');
        
        const productLink = $el.find('h2 a').first().attr('href');
        const productUrl = productLink 
          ? (productLink.startsWith('http') ? productLink : `https://www.amazon.com${productLink}`)
          : '';

        const ratingText = $el.find('[data-csa-c-type="widget"] .a-icon-alt, .a-star-small .a-icon-alt').first().text().trim();
        const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0] || '0') : undefined;

        const reviewText = $el.find('[data-csa-c-type="widget"] .a-size-base, .a-size-small').first().text().trim();
        const reviewCount = reviewText ? parseInt(reviewText.replace(/,/g, '').match(/\d+/)?.[0] || '0') : undefined;

        if (title && productUrl) {
          products.push({
            title,
            price,
            rating,
            reviewCount,
            imageUrl,
            productUrl,
            availability: 'Available',
          });
        }
      } catch (err) {
        console.error(`Error parsing Amazon product at index ${index}:`, err);
      }
    });

    console.log(`✅ Scraped ${products.length} products from Amazon`);
    return products;

  } catch (error: any) {
    console.error('❌ Error scraping Amazon products:', error.message);
    return [];
  }
}

/**
 * Main scraper function - determines source and scrapes accordingly
 */
export async function scrapeAffiliateProductUrl(affiliateProductId: number, url: string, source?: string): Promise<ScrapedProduct[]> {
  let products: ScrapedProduct[] = [];

  // Determine source from URL if not provided
  const detectedSource = source || (url.includes('noon.com') || url.includes('s.noon.com') ? 'noon' : 
                          url.includes('amazon') || url.includes('amzn.to') ? 'amazon' : 
                          'unknown');

  console.log(`\n🚀 Starting scrape for affiliate product #${affiliateProductId} (${detectedSource})`);

  if (detectedSource === 'noon') {
    products = await scrapeNoonProducts(url);
  } else if (detectedSource === 'amazon') {
    products = await scrapeAmazonProducts(url);
  } else {
    console.log(`⚠️ Unknown source: ${detectedSource}`);
    return [];
  }

  if (products.length > 0) {
    try {
      // Delete existing scraped products for this affiliate product
      await db.delete(scrapedAffiliateProducts)
        .where(eq(scrapedAffiliateProducts.affiliateProductId, affiliateProductId));

      // Insert new scraped products
      for (const product of products) {
        await db.insert(scrapedAffiliateProducts).values({
          affiliateProductId,
          ...product,
        });
      }

      // Update last scraped timestamp
      await db.update(affiliateProducts)
        .set({ lastScrapedAt: new Date() })
        .where(eq(affiliateProducts.id, affiliateProductId));

      console.log(`💾 Saved ${products.length} products to database for affiliate product #${affiliateProductId}\n`);
    } catch (dbError) {
      console.error('❌ Error saving scraped products to database:', dbError);
      throw dbError;
    }
  } else {
    console.log(`⚠️ No products scraped for affiliate product #${affiliateProductId}\n`);
  }

  return products;
}

/**
 * Scrape all active affiliate products
 */
export async function scrapeAllAffiliateProducts(): Promise<{ success: number; failed: number }> {
  console.log('🔄 Starting bulk scrape of all affiliate products...\n');
  
  const activeProducts = await db.select()
    .from(affiliateProducts)
    .where(eq(affiliateProducts.isActive, true));

  let success = 0;
  let failed = 0;

  for (const product of activeProducts) {
    try {
      if (product.scrapeEnabled !== false) {
        const products = await scrapeAffiliateProductUrl(product.id, product.url, product.source || undefined);
        if (products.length > 0) {
          success++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.error(`Failed to scrape product ${product.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Scraping complete: ${success} successful, ${failed} failed`);
  return { success, failed };
}
