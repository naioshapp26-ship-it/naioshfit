/**
 * Seed Sample Supplements Data
 * Creates a basic catalog of common supplements for testing
 */

import { db } from '../server/db';
import { supplements, supplementInteractions } from '../shared/schema';

async function seedSupplements() {
  console.log('🌱 Seeding sample supplements...');
  
  try {
    // Sample global supplements (admin-curated)
    const sampleSupplements = [
      {
        name: 'Whey Protein',
        nameAr: 'بروتين واي',
        forms: JSON.stringify(['powder', 'isolate']),
        ingredients: 'Whey protein concentrate, whey protein isolate, natural flavors, sweeteners',
        dosageRangeMin: 20,
        dosageRangeMax: 40,
        dosageUnit: 'g',
        contraindications: 'Dairy allergy, lactose intolerance',
        interactions: 'May interact with certain antibiotics',
        warnings: 'Consult doctor if you have kidney disease',
        categories: JSON.stringify(['protein', 'muscle_building', 'recovery']),
        evidenceNotes: 'Well-researched for muscle protein synthesis',
        references: 'Multiple peer-reviewed studies support efficacy',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Creatine Monohydrate',
        nameAr: 'كرياتين أحادي الهيدرات',
        forms: JSON.stringify(['powder', 'capsule']),
        ingredients: 'Creatine monohydrate',
        dosageRangeMin: 3,
        dosageRangeMax: 5,
        dosageUnit: 'g',
        contraindications: 'Kidney disease, dehydration',
        interactions: 'May interact with caffeine, NSAIDs',
        warnings: 'Ensure adequate hydration. Consult doctor if you have kidney issues.',
        categories: JSON.stringify(['performance', 'strength', 'muscle_building']),
        evidenceNotes: 'One of the most researched supplements for athletic performance',
        references: 'International Society of Sports Nutrition position stand',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Omega-3 Fish Oil',
        nameAr: 'زيت السمك أوميغا-3',
        forms: JSON.stringify(['softgel', 'liquid']),
        ingredients: 'EPA (Eicosapentaenoic acid), DHA (Docosahexaenoic acid)',
        dosageRangeMin: 1000,
        dosageRangeMax: 3000,
        dosageUnit: 'mg',
        contraindications: 'Fish/shellfish allergy, bleeding disorders',
        interactions: 'May interact with blood thinners (warfarin), antiplatelet drugs',
        warnings: 'Consult doctor if on blood-thinning medication or have bleeding disorders',
        categories: JSON.stringify(['health', 'heart', 'inflammation', 'general_wellness']),
        evidenceNotes: 'Supports cardiovascular health and reduces inflammation',
        references: 'American Heart Association recommendations',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Vitamin D3',
        nameAr: 'فيتامين د3',
        forms: JSON.stringify(['capsule', 'softgel', 'liquid']),
        ingredients: 'Cholecalciferol (Vitamin D3)',
        dosageRangeMin: 1000,
        dosageRangeMax: 4000,
        dosageUnit: 'IU',
        contraindications: 'Hypercalcemia, kidney stones',
        interactions: 'May interact with certain heart medications, steroids',
        warnings: 'Do not exceed recommended dose. Monitor calcium levels with high doses.',
        categories: JSON.stringify(['vitamins', 'bone_health', 'immunity', 'general_wellness']),
        evidenceNotes: 'Essential for bone health, immune function, and mood',
        references: 'NIH Office of Dietary Supplements',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Caffeine',
        nameAr: 'كافيين',
        forms: JSON.stringify(['capsule', 'tablet', 'powder']),
        ingredients: 'Caffeine anhydrous',
        dosageRangeMin: 100,
        dosageRangeMax: 400,
        dosageUnit: 'mg',
        contraindications: 'Heart conditions, anxiety disorders, high blood pressure, pregnancy',
        interactions: 'May interact with certain medications, creatine absorption',
        warnings: 'Avoid if you have heart issues or anxiety. May cause sleep disturbances.',
        categories: JSON.stringify(['pre_workout', 'performance', 'energy']),
        evidenceNotes: 'Proven ergogenic aid for endurance and power performance',
        references: 'International Society of Sports Nutrition',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Multivitamin',
        nameAr: 'فيتامينات متعددة',
        forms: JSON.stringify(['tablet', 'capsule', 'gummy']),
        ingredients: 'Various vitamins and minerals',
        dosageRangeMin: 1,
        dosageRangeMax: 2,
        dosageUnit: 'tablet',
        contraindications: 'Hemochromatosis (iron overload), certain medical conditions',
        interactions: 'May interact with certain medications',
        warnings: 'Do not exceed recommended dose. Iron in multivitamins can be toxic in high amounts.',
        categories: JSON.stringify(['vitamins', 'minerals', 'general_wellness']),
        evidenceNotes: 'Fills nutritional gaps in diet',
        references: 'Various nutritional guidelines',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'BCAA (Branched-Chain Amino Acids)',
        nameAr: 'أحماض أمينية متفرعة السلسلة',
        forms: JSON.stringify(['powder', 'capsule']),
        ingredients: 'Leucine, Isoleucine, Valine',
        dosageRangeMin: 5,
        dosageRangeMax: 10,
        dosageUnit: 'g',
        contraindications: 'ALS (Lou Gehrig\'s disease), branched-chain ketoaciduria',
        interactions: 'May affect blood sugar levels',
        warnings: 'May affect blood sugar. Monitor if diabetic.',
        categories: JSON.stringify(['amino_acids', 'recovery', 'muscle_building']),
        evidenceNotes: 'May reduce muscle soreness and support recovery',
        references: 'Mixed evidence on efficacy vs whole protein sources',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
      {
        name: 'Magnesium',
        nameAr: 'مغنيسيوم',
        forms: JSON.stringify(['capsule', 'tablet', 'powder']),
        ingredients: 'Magnesium citrate, magnesium glycinate, or other forms',
        dosageRangeMin: 200,
        dosageRangeMax: 400,
        dosageUnit: 'mg',
        contraindications: 'Kidney disease, certain heart conditions',
        interactions: 'May interact with antibiotics, bisphosphonates',
        warnings: 'High doses may cause diarrhea. Consult doctor if you have kidney disease.',
        categories: JSON.stringify(['minerals', 'sleep', 'recovery', 'general_wellness']),
        evidenceNotes: 'Important for muscle function, sleep, and stress management',
        references: 'NIH Office of Dietary Supplements',
        isGlobal: true,
        createdBy: null,
        scopeCoachId: null,
      },
    ];
    
    const insertedSupplements = await db.insert(supplements)
      .values(sampleSupplements)
      .returning();
    
    console.log(`✅ Inserted ${insertedSupplements.length} supplements`);
    
    // Sample interactions
    const wheyProtein = insertedSupplements.find(s => s.name === 'Whey Protein');
    const omega3 = insertedSupplements.find(s => s.name === 'Omega-3 Fish Oil');
    const caffeine = insertedSupplements.find(s => s.name === 'Caffeine');
    const creatine = insertedSupplements.find(s => s.name === 'Creatine Monohydrate');
    
    if (wheyProtein) {
      await db.insert(supplementInteractions).values([
        {
          supplementId: wheyProtein.id,
          interactsWith: 'dairy',
          interactionType: 'allergy',
          severity: 'critical',
          description: 'Whey protein is derived from milk and should not be used by individuals with dairy allergies.',
          actionRequired: 'hard_block',
        },
        {
          supplementId: wheyProtein.id,
          interactsWith: 'lactose intolerance',
          interactionType: 'medical_condition',
          severity: 'moderate',
          description: 'May cause digestive discomfort in lactose-intolerant individuals. Consider whey isolate or plant-based alternatives.',
          actionRequired: 'warning',
        },
      ]);
      console.log('✅ Added interactions for Whey Protein');
    }
    
    if (omega3) {
      await db.insert(supplementInteractions).values([
        {
          supplementId: omega3.id,
          interactsWith: 'warfarin',
          interactionType: 'medication',
          severity: 'severe',
          description: 'Omega-3 may increase bleeding risk when combined with blood thinners like warfarin.',
          actionRequired: 'confirmation_required',
        },
        {
          supplementId: omega3.id,
          interactsWith: 'fish',
          interactionType: 'allergy',
          severity: 'critical',
          description: 'Fish oil supplements should not be used by individuals with fish or shellfish allergies.',
          actionRequired: 'hard_block',
        },
      ]);
      console.log('✅ Added interactions for Omega-3 Fish Oil');
    }
    
    if (caffeine && creatine) {
      await db.insert(supplementInteractions).values([
        {
          supplementId: caffeine.id,
          interactsWith: 'Creatine Monohydrate',
          interactionType: 'supplement',
          severity: 'mild',
          description: 'Caffeine may reduce creatine absorption. Consider separating intake times.',
          actionRequired: 'warning',
        },
        {
          supplementId: caffeine.id,
          interactsWith: 'anxiety',
          interactionType: 'medical_condition',
          severity: 'moderate',
          description: 'Caffeine can worsen anxiety symptoms.',
          actionRequired: 'confirmation_required',
        },
      ]);
      console.log('✅ Added interactions for Caffeine');
    }
    
    console.log('\n✅ Sample supplements seeding completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Error seeding supplements:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seedSupplements();
