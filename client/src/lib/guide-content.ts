// Guide content for each page in the application
// This provides contextual help for users

export interface GuideSection {
  title: string;
  content: string;
}

export interface PageGuide {
  pageTitle: string;
  pageExplanation: string;
  importantButtons?: GuideSection[];
  mainFields?: GuideSection[];
  notesAndTips?: string[];
}

export type PagePath = 
  | '/dashboard' 
  | '/nutrition' 
  | '/workouts' 
  | '/progress' 
  | '/settings' 
  | '/profile' 
  | '/store' 
  | '/orders' 
  | '/messages' 
  | '/admin' 
  | '/coach' 
  | '/gym'
  | '/content-library'
  | '/blog'
  | '/courses'
  | '/supplements'
  | '/alerts'
  | '/files-reports'
  | '/community'
  | '/food-search'
  | '/taxonomy'
  | '/ads-courses'
  | '/manage-courses'
  | '/manage-orders'
  | '/tenant'
  | '/security'
  | '/';

export const guideContent: Record<PagePath, { en: PageGuide; ar: PageGuide }> = {
  '/dashboard': {
    en: {
      pageTitle: 'Dashboard',
      pageExplanation: 'Your main fitness hub. Track your daily progress, view your streaks, monitor your points, and see an overview of your nutrition and workout activities.',
      importantButtons: [
        { title: 'View Stats', content: 'Click on any stat card to see detailed information about your progress' },
        { title: 'Quick Actions', content: 'Access quick shortcuts to log meals, start workouts, or update your weight' },
      ],
      mainFields: [
        { title: 'Streak Counter', content: 'Shows consecutive days of activity. Keep it going to build healthy habits!' },
        { title: 'Points', content: 'Earn points for completing workouts, logging meals, and achieving goals' },
        { title: 'Daily Summary', content: 'View today\'s nutrition and workout completion status' },
      ],
      notesAndTips: [
        'Check your dashboard daily to stay motivated and track your consistency',
        'Your coach can see your progress, so keep your logs updated',
        'Set daily reminders to log your meals and complete workouts',
      ],
    },
    ar: {
      pageTitle: 'لوحة التحكم',
      pageExplanation: 'مركز اللياقة الرئيسي الخاص بك. تتبع تقدمك اليومي، اعرض سلسلة إنجازاتك، راقب نقاطك، واطلع على نظرة عامة على أنشطة التغذية والتمارين الخاصة بك.',
      importantButtons: [
        { title: 'عرض الإحصائيات', content: 'انقر على أي بطاقة إحصائية لرؤية معلومات تفصيلية حول تقدمك' },
        { title: 'الإجراءات السريعة', content: 'الوصول إلى اختصارات سريعة لتسجيل الوجبات أو بدء التمارين أو تحديث وزنك' },
      ],
      mainFields: [
        { title: 'عداد السلسلة', content: 'يعرض الأيام المتتالية من النشاط. استمر في ذلك لبناء عادات صحية!' },
        { title: 'النقاط', content: 'اكسب نقاطاً عند إكمال التمارين وتسجيل الوجبات وتحقيق الأهداف' },
        { title: 'الملخص اليومي', content: 'اعرض حالة إكمال التغذية والتمارين لليوم' },
      ],
      notesAndTips: [
        'تحقق من لوحة التحكم يومياً للبقاء متحفزاً وتتبع اتساقك',
        'يمكن لمدربك رؤية تقدمك، لذا حافظ على تحديث سجلاتك',
        'اضبط تذكيرات يومية لتسجيل وجباتك وإكمال تمارينك',
      ],
    },
  },
  '/nutrition': {
    en: {
      pageTitle: 'Nutrition Tracking',
      pageExplanation: 'Log and track your daily meals and nutrition. Monitor your calorie intake, macronutrients (protein, carbs, fats), and maintain a healthy diet according to your fitness goals.',
      importantButtons: [
        { title: 'Add Meal', content: 'Click to log a new meal with detailed food items and quantities' },
        { title: 'Food Search', content: 'Search from our extensive food database or create custom foods' },
        { title: 'Barcode Scanner', content: 'Scan product barcodes to quickly add packaged foods' },
        { title: 'Edit/Delete Meal', content: 'Modify or remove meals you\'ve already logged' },
      ],
      mainFields: [
        { title: 'Daily Totals', content: 'See your total calories, protein, carbs, and fats for the day' },
        { title: 'Meal Time', content: 'Organize meals by time: breakfast, lunch, dinner, or snacks' },
        { title: 'Food Items', content: 'Each meal can contain multiple food items with serving sizes' },
      ],
      notesAndTips: [
        'Log meals immediately after eating for better accuracy',
        'Use the barcode scanner for packaged foods to save time',
        'Your coach can assign you a nutrition plan - follow it for best results',
        'Track water intake separately in the dashboard',
      ],
    },
    ar: {
      pageTitle: 'تتبع التغذية',
      pageExplanation: 'سجل وتتبع وجباتك اليومية وتغذيتك. راقب كمية السعرات الحرارية، المغذيات الكبرى (البروتين، الكربوهيدرات، الدهون)، وحافظ على نظام غذائي صحي وفقاً لأهداف لياقتك.',
      importantButtons: [
        { title: 'إضافة وجبة', content: 'انقر لتسجيل وجبة جديدة مع عناصر الطعام والكميات التفصيلية' },
        { title: 'البحث عن الطعام', content: 'ابحث من قاعدة بيانات الأطعمة الواسعة أو أنشئ أطعمة مخصصة' },
        { title: 'ماسح الباركود', content: 'امسح الباركود على المنتجات لإضافة الأطعمة المعبأة بسرعة' },
        { title: 'تعديل/حذف الوجبة', content: 'عدل أو احذف الوجبات التي سجلتها بالفعل' },
      ],
      mainFields: [
        { title: 'المجاميع اليومية', content: 'اطلع على إجمالي السعرات الحرارية والبروتين والكربوهيدرات والدهون لليوم' },
        { title: 'وقت الوجبة', content: 'نظم الوجبات حسب الوقت: الإفطار، الغداء، العشاء، أو الوجبات الخفيفة' },
        { title: 'عناصر الطعام', content: 'يمكن أن تحتوي كل وجبة على عدة عناصر طعام بأحجام حصص مختلفة' },
      ],
      notesAndTips: [
        'سجل الوجبات فوراً بعد الأكل للحصول على دقة أفضل',
        'استخدم ماسح الباركود للأطعمة المعبأة لتوفير الوقت',
        'يمكن لمدربك تعيين خطة تغذية لك - اتبعها للحصول على أفضل النتائج',
        'تتبع شرب الماء بشكل منفصل في لوحة التحكم',
      ],
    },
  },
  '/workouts': {
    en: {
      pageTitle: 'Workouts & Exercise',
      pageExplanation: 'View, schedule, and complete your workout routines. Access exercise video tutorials, track sets and reps, and follow your coach\'s personalized training plan.',
      importantButtons: [
        { title: 'Add Workout', content: 'Create a new workout session with exercises, sets, and reps' },
        { title: 'Start Workout', content: 'Begin tracking your workout session in real-time' },
        { title: 'Mark Complete', content: 'Log completed exercises and sets as you finish them' },
        { title: 'View Video Tutorial', content: 'Watch demonstration videos for proper form and technique' },
      ],
      mainFields: [
        { title: 'Exercise List', content: 'See all exercises in your current workout plan' },
        { title: 'Sets & Reps', content: 'Track the number of sets and repetitions for each exercise' },
        { title: 'Weight/Resistance', content: 'Log the weight or resistance level used' },
        { title: 'Rest Timer', content: 'Built-in timer to track rest periods between sets' },
      ],
      notesAndTips: [
        'Watch video tutorials before trying new exercises',
        'Log your weights to track strength progression over time',
        'Follow your coach\'s prescribed sets and reps for optimal results',
        'Take adequate rest between sets - quality over quantity',
        'Mark exercises as complete only when done with proper form',
      ],
    },
    ar: {
      pageTitle: 'التمارين والتدريبات',
      pageExplanation: 'اعرض، جدول، وأكمل روتين التمارين الخاصة بك. الوصول إلى فيديوهات تعليمية للتمارين، تتبع المجموعات والتكرارات، واتبع خطة التدريب الشخصية من مدربك.',
      importantButtons: [
        { title: 'إضافة تمرين', content: 'أنشئ جلسة تمرين جديدة مع التمارين والمجموعات والتكرارات' },
        { title: 'بدء التمرين', content: 'ابدأ تتبع جلسة التمرين الخاصة بك في الوقت الفعلي' },
        { title: 'تحديد كمكتمل', content: 'سجل التمارين والمجموعات المكتملة أثناء إنهائها' },
        { title: 'عرض فيديو تعليمي', content: 'شاهد فيديوهات توضيحية للوضعية والتقنية الصحيحة' },
      ],
      mainFields: [
        { title: 'قائمة التمارين', content: 'اطلع على جميع التمارين في خطة التمرين الحالية' },
        { title: 'المجموعات والتكرارات', content: 'تتبع عدد المجموعات والتكرارات لكل تمرين' },
        { title: 'الوزن/المقاومة', content: 'سجل الوزن أو مستوى المقاومة المستخدم' },
        { title: 'مؤقت الراحة', content: 'مؤقت مدمج لتتبع فترات الراحة بين المجموعات' },
      ],
      notesAndTips: [
        'شاهد الفيديوهات التعليمية قبل تجربة تمارين جديدة',
        'سجل أوزانك لتتبع تقدم القوة مع مرور الوقت',
        'اتبع المجموعات والتكرارات المحددة من مدربك للحصول على نتائج مثالية',
        'خذ راحة كافية بين المجموعات - الجودة أهم من الكمية',
        'حدد التمارين كمكتملة فقط عند القيام بها بالوضعية الصحيحة',
      ],
    },
  },
  '/progress': {
    en: {
      pageTitle: 'Progress Tracking',
      pageExplanation: 'Monitor your fitness journey with detailed charts and metrics. Track weight changes, body measurements, and view your progress over time with visual graphs.',
      importantButtons: [
        { title: 'Update Weight', content: 'Log your current weight with date and time' },
        { title: 'Add Notes', content: 'Add personal notes about how you feel or observations' },
        { title: 'View Charts', content: 'Toggle between different chart views (weight, nutrition, workouts)' },
        { title: 'Change Date Range', content: 'Select different time periods (week, month, year) to view trends' },
      ],
      mainFields: [
        { title: 'Weight Chart', content: 'Visual graph showing your weight changes over time' },
        { title: 'Current Weight', content: 'Your most recent weight entry' },
        { title: 'Goal Weight', content: 'Target weight you\'re working towards' },
        { title: 'Progress Percentage', content: 'How close you are to your goal' },
      ],
      notesAndTips: [
        'Weigh yourself at the same time each day for consistency',
        'Don\'t worry about daily fluctuations - focus on weekly trends',
        'Take progress photos monthly to see changes beyond the scale',
        'Your coach can see your progress charts to adjust your plan',
        'Be patient - healthy weight loss is typically 0.5-1kg per week',
      ],
    },
    ar: {
      pageTitle: 'تتبع التقدم',
      pageExplanation: 'راقب رحلة لياقتك مع رسوم بيانية ومقاييس مفصلة. تتبع التغييرات في الوزن، قياسات الجسم، واعرض تقدمك مع مرور الوقت من خلال رسوم بيانية مرئية.',
      importantButtons: [
        { title: 'تحديث الوزن', content: 'سجل وزنك الحالي مع التاريخ والوقت' },
        { title: 'إضافة ملاحظات', content: 'أضف ملاحظات شخصية حول شعورك أو ملاحظاتك' },
        { title: 'عرض الرسوم البيانية', content: 'التبديل بين طرق عرض الرسوم المختلفة (الوزن، التغذية، التمارين)' },
        { title: 'تغيير نطاق التاريخ', content: 'اختر فترات زمنية مختلفة (أسبوع، شهر، سنة) لعرض الاتجاهات' },
      ],
      mainFields: [
        { title: 'رسم بياني للوزن', content: 'رسم بياني مرئي يوضح تغييرات وزنك مع مرور الوقت' },
        { title: 'الوزن الحالي', content: 'أحدث إدخال لوزنك' },
        { title: 'الوزن المستهدف', content: 'الوزن المستهدف الذي تعمل على تحقيقه' },
        { title: 'نسبة التقدم', content: 'مدى قربك من تحقيق هدفك' },
      ],
      notesAndTips: [
        'زن نفسك في نفس الوقت كل يوم للحصول على اتساق',
        'لا تقلق بشأن التقلبات اليومية - ركز على الاتجاهات الأسبوعية',
        'التقط صور تقدم شهرية لرؤية التغييرات بعيداً عن الميزان',
        'يمكن لمدربك رؤية رسوم التقدم البيانية لتعديل خطتك',
        'كن صبوراً - فقدان الوزن الصحي عادة 0.5-1 كجم في الأسبوع',
      ],
    },
  },
  '/settings': {
    en: {
      pageTitle: 'Account Settings',
      pageExplanation: 'Manage your account preferences, security settings, notification options, and billing information. Customize your experience and control your privacy.',
      importantButtons: [
        { title: 'Update Password', content: 'Change your account password for security' },
        { title: 'Toggle Notifications', content: 'Enable or disable email and push notifications' },
        { title: 'Logout', content: 'Sign out of your account on this device' },
        { title: 'Delete Account', content: 'Permanently delete your account and all data (cannot be undone)' },
      ],
      mainFields: [
        { title: 'Account Tab', content: 'Personal information, language preferences, and timezone' },
        { title: 'Notifications Tab', content: 'Control which notifications you receive' },
        { title: 'Billing Tab', content: 'View subscription status and payment methods' },
        { title: 'Security Tab', content: 'Password, sessions, and security options' },
      ],
      notesAndTips: [
        'Use a strong, unique password for your account',
        'Enable two-factor authentication if available for extra security',
        'Review active sessions regularly and log out unused devices',
        'Keep your email updated to receive important notifications',
        'Contact support before deleting your account if you have issues',
      ],
    },
    ar: {
      pageTitle: 'إعدادات الحساب',
      pageExplanation: 'إدارة تفضيلات حسابك، إعدادات الأمان، خيارات الإشعارات، ومعلومات الفوترة. خصص تجربتك وتحكم في خصوصيتك.',
      importantButtons: [
        { title: 'تحديث كلمة المرور', content: 'غير كلمة مرور حسابك للأمان' },
        { title: 'تبديل الإشعارات', content: 'تفعيل أو تعطيل إشعارات البريد الإلكتروني والدفع' },
        { title: 'تسجيل الخروج', content: 'تسجيل الخروج من حسابك على هذا الجهاز' },
        { title: 'حذف الحساب', content: 'حذف حسابك وجميع البيانات نهائياً (لا يمكن التراجع)' },
      ],
      mainFields: [
        { title: 'تبويب الحساب', content: 'المعلومات الشخصية، تفضيلات اللغة، والمنطقة الزمنية' },
        { title: 'تبويب الإشعارات', content: 'تحكم في الإشعارات التي تتلقاها' },
        { title: 'تبويب الفوترة', content: 'اعرض حالة الاشتراك وطرق الدفع' },
        { title: 'تبويب الأمان', content: 'كلمة المرور، الجلسات، وخيارات الأمان' },
      ],
      notesAndTips: [
        'استخدم كلمة مرور قوية وفريدة لحسابك',
        'فعّل المصادقة الثنائية إن وُجدت للأمان الإضافي',
        'راجع الجلسات النشطة بانتظام وسجل خروج الأجهزة غير المستخدمة',
        'حافظ على تحديث بريدك الإلكتروني لتلقي الإشعارات المهمة',
        'اتصل بالدعم قبل حذف حسابك إذا كانت لديك مشاكل',
      ],
    },
  },
  '/profile': {
    en: {
      pageTitle: 'User Profile',
      pageExplanation: 'View and edit your personal profile information. Update your fitness goals, personal details, and see your subscription status and coach information.',
      importantButtons: [
        { title: 'Edit Profile', content: 'Update your personal information and fitness details' },
        { title: 'Upload Photo', content: 'Add or change your profile picture' },
        { title: 'View Coach Info', content: 'See details about your assigned coach (if you have one)' },
      ],
      mainFields: [
        { title: 'Personal Info', content: 'Name, age, gender, and contact details' },
        { title: 'Fitness Goals', content: 'Your target weight, fitness level, and objectives' },
        { title: 'Subscription', content: 'Current plan and membership status' },
        { title: 'Coach Assignment', content: 'Information about your personal coach' },
      ],
      notesAndTips: [
        'Keep your profile updated for better personalized recommendations',
        'Set realistic fitness goals and review them monthly',
        'A complete profile helps your coach create better plans for you',
        'Your profile photo helps your coach recognize you',
      ],
    },
    ar: {
      pageTitle: 'الملف الشخصي',
      pageExplanation: 'اعرض وعدل معلومات ملفك الشخصي. حدث أهداف لياقتك، تفاصيلك الشخصية، واطلع على حالة اشتراكك ومعلومات مدربك.',
      importantButtons: [
        { title: 'تعديل الملف', content: 'حدث معلوماتك الشخصية وتفاصيل لياقتك' },
        { title: 'رفع صورة', content: 'أضف أو غير صورة ملفك الشخصي' },
        { title: 'عرض معلومات المدرب', content: 'اطلع على تفاصيل المدرب المعين لك (إن وُجد)' },
      ],
      mainFields: [
        { title: 'المعلومات الشخصية', content: 'الاسم، العمر، الجنس، وتفاصيل الاتصال' },
        { title: 'أهداف اللياقة', content: 'وزنك المستهدف، مستوى اللياقة، والأهداف' },
        { title: 'الاشتراك', content: 'الخطة الحالية وحالة العضوية' },
        { title: 'تعيين المدرب', content: 'معلومات عن مدربك الشخصي' },
      ],
      notesAndTips: [
        'حافظ على تحديث ملفك للحصول على توصيات شخصية أفضل',
        'ضع أهداف لياقة واقعية وراجعها شهرياً',
        'ملف كامل يساعد مدربك على إنشاء خطط أفضل لك',
        'صورة ملفك تساعد مدربك على التعرف عليك',
      ],
    },
  },
  '/store': {
    en: {
      pageTitle: 'Product Store',
      pageExplanation: 'Browse and purchase fitness supplements, equipment, and nutrition products. All products are carefully selected and recommended by fitness professionals.',
      importantButtons: [
        { title: 'Add to Cart', content: 'Add products to your shopping cart' },
        { title: 'View Details', content: 'See full product information, ingredients, and reviews' },
        { title: 'Checkout', content: 'Proceed to payment and complete your order' },
      ],
      mainFields: [
        { title: 'Product Categories', content: 'Filter products by type: supplements, equipment, nutrition' },
        { title: 'Price', content: 'Product pricing in your local currency' },
        { title: 'Reviews & Ratings', content: 'User feedback and star ratings' },
      ],
      notesAndTips: [
        'Check with your coach before buying supplements',
        'Read product reviews and ratings before purchasing',
        'Look for bundle deals to save money',
        'Free shipping is usually available on orders over a certain amount',
      ],
    },
    ar: {
      pageTitle: 'متجر المنتجات',
      pageExplanation: 'تصفح واشتر مكملات اللياقة، المعدات، ومنتجات التغذية. جميع المنتجات تم اختيارها بعناية وموصى بها من محترفي اللياقة.',
      importantButtons: [
        { title: 'إضافة للسلة', content: 'أضف المنتجات إلى سلة التسوق الخاصة بك' },
        { title: 'عرض التفاصيل', content: 'اطلع على معلومات المنتج الكاملة، المكونات، والمراجعات' },
        { title: 'الدفع', content: 'انتقل إلى الدفع وأكمل طلبك' },
      ],
      mainFields: [
        { title: 'فئات المنتجات', content: 'فلتر المنتجات حسب النوع: مكملات، معدات، تغذية' },
        { title: 'السعر', content: 'أسعار المنتجات بعملتك المحلية' },
        { title: 'المراجعات والتقييمات', content: 'آراء المستخدمين وتقييمات النجوم' },
      ],
      notesAndTips: [
        'استشر مدربك قبل شراء المكملات',
        'اقرأ مراجعات وتقييمات المنتج قبل الشراء',
        'ابحث عن عروض الحزم لتوفير المال',
        'الشحن المجاني عادة متاح للطلبات فوق مبلغ معين',
      ],
    },
  },
  '/orders': {
    en: {
      pageTitle: 'Order History',
      pageExplanation: 'View your purchase history, track order status, and manage returns. Access invoices and receipts for all your transactions.',
      importantButtons: [
        { title: 'View Order Details', content: 'See full information about a specific order' },
        { title: 'Track Shipment', content: 'Follow your package delivery status' },
        { title: 'Download Invoice', content: 'Get a PDF receipt for your records' },
      ],
      mainFields: [
        { title: 'Order Number', content: 'Unique identifier for tracking your order' },
        { title: 'Order Status', content: 'Current state: pending, processing, shipped, delivered' },
        { title: 'Items', content: 'List of products in the order' },
        { title: 'Total Amount', content: 'Final price including taxes and shipping' },
      ],
      notesAndTips: [
        'Save your order number for customer support inquiries',
        'Check delivery estimates in your order confirmation email',
        'Contact support within 7 days for any issues with your order',
      ],
    },
    ar: {
      pageTitle: 'سجل الطلبات',
      pageExplanation: 'اعرض سجل مشترياتك، تتبع حالة الطلب، وإدارة الإرجاعات. الوصول إلى الفواتير والإيصالات لجميع معاملاتك.',
      importantButtons: [
        { title: 'عرض تفاصيل الطلب', content: 'اطلع على المعلومات الكاملة لطلب محدد' },
        { title: 'تتبع الشحنة', content: 'تابع حالة تسليم الطرد الخاص بك' },
        { title: 'تحميل الفاتورة', content: 'احصل على إيصال PDF لسجلاتك' },
      ],
      mainFields: [
        { title: 'رقم الطلب', content: 'معرف فريد لتتبع طلبك' },
        { title: 'حالة الطلب', content: 'الحالة الحالية: قيد الانتظار، قيد المعالجة، تم الشحن، تم التسليم' },
        { title: 'العناصر', content: 'قائمة المنتجات في الطلب' },
        { title: 'المبلغ الإجمالي', content: 'السعر النهائي شاملاً الضرائب والشحن' },
      ],
      notesAndTips: [
        'احفظ رقم طلبك لاستفسارات دعم العملاء',
        'تحقق من تقديرات التسليم في بريد تأكيد الطلب',
        'اتصل بالدعم خلال 7 أيام لأي مشاكل مع طلبك',
      ],
    },
  },
  '/messages': {
    en: {
      pageTitle: 'Messages',
      pageExplanation: 'Communicate directly with your coach or clients. Get personalized advice, ask questions, and receive feedback on your progress.',
      importantButtons: [
        { title: 'Send Message', content: 'Type and send a message to your selected contact' },
        { title: 'Select Conversation', content: 'Choose a coach or client to chat with' },
        { title: 'Mark as Read', content: 'Clear unread message notifications' },
      ],
      mainFields: [
        { title: 'User List', content: 'Shows your coach or clients you can message' },
        { title: 'Chat Area', content: 'View message history and conversation' },
        { title: 'Unread Count', content: 'Number of new messages from each contact' },
      ],
      notesAndTips: [
        'Be specific when asking your coach questions',
        'Include relevant details (weight, meals, workouts) when discussing progress',
        'Coaches typically respond within 24 hours on business days',
        'Use messages for guidance, not medical emergencies',
      ],
    },
    ar: {
      pageTitle: 'الرسائل',
      pageExplanation: 'تواصل مباشرة مع مدربك أو عملائك. احصل على نصائح شخصية، اطرح أسئلة، وتلقَ ملاحظات على تقدمك.',
      importantButtons: [
        { title: 'إرسال رسالة', content: 'اكتب وأرسل رسالة إلى جهة الاتصال المحددة' },
        { title: 'اختيار محادثة', content: 'اختر مدرباً أو عميلاً للدردشة معه' },
        { title: 'تحديد كمقروء', content: 'امسح إشعارات الرسائل غير المقروءة' },
      ],
      mainFields: [
        { title: 'قائمة المستخدمين', content: 'تعرض مدربك أو عملائك الذين يمكنك مراسلتهم' },
        { title: 'منطقة الدردشة', content: 'اعرض سجل الرسائل والمحادثة' },
        { title: 'عدد غير المقروءة', content: 'عدد الرسائل الجديدة من كل جهة اتصال' },
      ],
      notesAndTips: [
        'كن محدداً عند طرح أسئلة على مدربك',
        'قدم تفاصيل ذات صلة (الوزن، الوجبات، التمارين) عند مناقشة التقدم',
        'المدربون عادة يردون خلال 24 ساعة في أيام العمل',
        'استخدم الرسائل للإرشاد، وليس لحالات الطوارئ الطبية',
      ],
    },
  },
  '/admin': {
    en: {
      pageTitle: 'Admin Dashboard',
      pageExplanation: 'Complete system administration control. Manage users, coaches, plans, billing, analytics, and all platform settings. Full oversight of the entire fitness platform.',
      importantButtons: [
        { title: 'Create/Edit Plans', content: 'Define workout and nutrition plans for users' },
        { title: 'Manage Users', content: 'View, edit, approve, or deactivate user accounts' },
        { title: 'Assign Coaches', content: 'Link coaches with their clients' },
        { title: 'Configure Billing', content: 'Set up pricing, subscriptions, and payment settings' },
      ],
      mainFields: [
        { title: 'User Management', content: 'Tables showing all users, coaches, and gym owners' },
        { title: 'Analytics Dashboard', content: 'Charts with revenue, user growth, and engagement metrics' },
        { title: 'Plan Editor', content: 'Create and modify workout and nutrition templates' },
        { title: 'System Settings', content: 'Platform-wide configuration and feature toggles' },
      ],
      notesAndTips: [
        'Use filters to quickly find specific users or records',
        'Review analytics daily to monitor platform health',
        'Test changes in a sandbox before applying to production',
        'Back up critical data before making bulk changes',
        'Document any custom configurations for team reference',
      ],
    },
    ar: {
      pageTitle: 'لوحة تحكم الإدارة',
      pageExplanation: 'التحكم الكامل في إدارة النظام. إدارة المستخدمين، المدربين، الخطط، الفوترة، التحليلات، وجميع إعدادات المنصة. إشراف كامل على منصة اللياقة بأكملها.',
      importantButtons: [
        { title: 'إنشاء/تعديل الخطط', content: 'حدد خطط التمارين والتغذية للمستخدمين' },
        { title: 'إدارة المستخدمين', content: 'اعرض، عدل، وافق، أو عطّل حسابات المستخدمين' },
        { title: 'تعيين المدربين', content: 'اربط المدربين بعملائهم' },
        { title: 'تكوين الفوترة', content: 'اضبط التسعير، الاشتراكات، وإعدادات الدفع' },
      ],
      mainFields: [
        { title: 'إدارة المستخدمين', content: 'جداول تعرض جميع المستخدمين والمدربين وأصحاب الصالات' },
        { title: 'لوحة التحليلات', content: 'رسوم بيانية للإيرادات، نمو المستخدمين، ومقاييس التفاعل' },
        { title: 'محرر الخطط', content: 'أنشئ وعدل قوالب التمارين والتغذية' },
        { title: 'إعدادات النظام', content: 'تكوين على مستوى المنصة وتبديلات الميزات' },
      ],
      notesAndTips: [
        'استخدم الفلاتر للعثور بسرعة على مستخدمين أو سجلات محددة',
        'راجع التحليلات يومياً لمراقبة صحة المنصة',
        'اختبر التغييرات في بيئة تجريبية قبل تطبيقها على الإنتاج',
        'نسخ احتياطي للبيانات المهمة قبل إجراء تغييرات جماعية',
        'وثق أي تكوينات مخصصة لمرجع الفريق',
      ],
    },
  },
  '/coach': {
    en: {
      pageTitle: 'Coach Dashboard',
      pageExplanation: 'Manage your clients, create personalized fitness plans, upload educational content, and track client progress. Your hub for professional coaching.',
      importantButtons: [
        { title: 'Assign Workout Plans', content: 'Create and assign custom workout routines to clients' },
        { title: 'Upload Videos', content: 'Add exercise tutorial videos for your clients' },
        { title: 'Create Courses', content: 'Build educational courses with lessons and quizzes' },
        { title: 'Issue Certificates', content: 'Award completion certificates to clients' },
      ],
      mainFields: [
        { title: 'Client List', content: 'View all clients assigned to you with their progress' },
        { title: 'Content Library', content: 'Your uploaded videos, courses, and educational materials' },
        { title: 'Progress Tracking', content: 'Monitor client workouts, nutrition, and weight changes' },
      ],
      notesAndTips: [
        'Review client progress weekly and adjust plans accordingly',
        'Create high-quality video content to help clients with form',
        'Respond to client messages promptly to build trust',
        'Use templates for common workout plans to save time',
        'Celebrate client milestones to keep them motivated',
      ],
    },
    ar: {
      pageTitle: 'لوحة تحكم المدرب',
      pageExplanation: 'إدارة عملائك، إنشاء خطط لياقة شخصية، رفع محتوى تعليمي، وتتبع تقدم العملاء. مركزك للتدريب المهني.',
      importantButtons: [
        { title: 'تعيين خطط التمارين', content: 'أنشئ وعيّن روتينات تمارين مخصصة للعملاء' },
        { title: 'رفع فيديوهات', content: 'أضف فيديوهات تعليمية للتمارين لعملائك' },
        { title: 'إنشاء دورات', content: 'انشئ دورات تعليمية مع دروس واختبارات' },
        { title: 'إصدار شهادات', content: 'امنح شهادات إتمام للعملاء' },
      ],
      mainFields: [
        { title: 'قائمة العملاء', content: 'اعرض جميع العملاء المعينين لك مع تقدمهم' },
        { title: 'مكتبة المحتوى', content: 'فيديوهاتك المرفوعة، الدورات، والمواد التعليمية' },
        { title: 'تتبع التقدم', content: 'راقب تمارين العملاء، التغذية، وتغييرات الوزن' },
      ],
      notesAndTips: [
        'راجع تقدم العملاء أسبوعياً وعدل الخطط وفقاً لذلك',
        'أنشئ محتوى فيديو عالي الجودة لمساعدة العملاء في الوضعية',
        'رد على رسائل العملاء بسرعة لبناء الثقة',
        'استخدم قوالب لخطط التمارين الشائعة لتوفير الوقت',
        'احتفل بإنجازات العملاء لإبقائهم متحفزين',
      ],
    },
  },
  '/gym': {
    en: {
      pageTitle: 'Gym Management',
      pageExplanation: 'Manage your gym members, coaches, and facility operations. Approve new members, assign coaches, and oversee your fitness center administration.',
      importantButtons: [
        { title: 'Approve Members', content: 'Review and approve pending membership applications' },
        { title: 'Assign Coaches', content: 'Link coaches with gym members for training' },
        { title: 'Manage Permissions', content: 'Control access levels for staff and members' },
      ],
      mainFields: [
        { title: 'Coaches List', content: 'All coaches working at your gym' },
        { title: 'Members List', content: 'Athletes and members using your facility' },
        { title: 'Approval Status', content: 'Pending, approved, or rejected member requests' },
      ],
      notesAndTips: [
        'Review new member applications daily',
        'Ensure each member has an assigned coach for best results',
        'Monitor coach workload to maintain quality service',
        'Keep member information up-to-date for accurate records',
      ],
    },
    ar: {
      pageTitle: 'إدارة الصالة الرياضية',
      pageExplanation: 'إدارة أعضاء الصالة، المدربين، وعمليات المنشأة. الموافقة على أعضاء جدد، تعيين المدربين، والإشراف على إدارة مركز اللياقة الخاص بك.',
      importantButtons: [
        { title: 'الموافقة على الأعضاء', content: 'راجع ووافق على طلبات العضوية المعلقة' },
        { title: 'تعيين المدربين', content: 'اربط المدربين بأعضاء الصالة للتدريب' },
        { title: 'إدارة الصلاحيات', content: 'تحكم في مستويات الوصول للموظفين والأعضاء' },
      ],
      mainFields: [
        { title: 'قائمة المدربين', content: 'جميع المدربين العاملين في صالتك' },
        { title: 'قائمة الأعضاء', content: 'الرياضيون والأعضاء الذين يستخدمون منشأتك' },
        { title: 'حالة الموافقة', content: 'طلبات الأعضاء المعلقة أو المعتمدة أو المرفوضة' },
      ],
      notesAndTips: [
        'راجع طلبات الأعضاء الجدد يومياً',
        'تأكد من أن كل عضو لديه مدرب معين لأفضل النتائج',
        'راقب عبء عمل المدربين للحفاظ على جودة الخدمة',
        'حافظ على تحديث معلومات الأعضاء للحصول على سجلات دقيقة',
      ],
    },
  },
  '/content-library': {
    en: {
      pageTitle: 'Content Library',
      pageExplanation: 'Access educational resources including courses, videos, articles, and tutorials. Learn about nutrition, exercise techniques, and fitness science.',
      importantButtons: [
        { title: 'Browse Content', content: 'Explore available courses and educational materials' },
        { title: 'Enroll in Course', content: 'Start learning from structured courses' },
        { title: 'Bookmark', content: 'Save content for quick access later' },
      ],
      mainFields: [
        { title: 'Courses', content: 'Structured learning paths with lessons and quizzes' },
        { title: 'Videos', content: 'Exercise tutorials and educational videos' },
        { title: 'Progress Tracking', content: 'Track your course completion status' },
      ],
      notesAndTips: [
        'Complete courses at your own pace',
        'Take quizzes to test your understanding',
        'Apply what you learn to your training routine',
      ],
    },
    ar: {
      pageTitle: 'مكتبة المحتوى',
      pageExplanation: 'الوصول إلى الموارد التعليمية بما في ذلك الدورات، الفيديوهات، المقالات، والدروس. تعلم عن التغذية، تقنيات التمارين، وعلوم اللياقة.',
      importantButtons: [
        { title: 'تصفح المحتوى', content: 'استكشف الدورات والمواد التعليمية المتاحة' },
        { title: 'التسجيل في دورة', content: 'ابدأ التعلم من دورات منظمة' },
        { title: 'حفظ', content: 'احفظ المحتوى للوصول السريع لاحقاً' },
      ],
      mainFields: [
        { title: 'الدورات', content: 'مسارات تعليمية منظمة مع دروس واختبارات' },
        { title: 'الفيديوهات', content: 'دروس تعليمية للتمارين وفيديوهات تعليمية' },
        { title: 'تتبع التقدم', content: 'تتبع حالة إكمال الدورة' },
      ],
      notesAndTips: [
        'أكمل الدورات بوتيرتك الخاصة',
        'خذ الاختبارات لاختبار فهمك',
        'طبق ما تتعلمه على روتين تدريبك',
      ],
    },
  },
  '/blog': {
    en: {
      pageTitle: 'Blog & Articles',
      pageExplanation: 'Read fitness tips, nutrition advice, success stories, and expert insights from coaches and the fitness community.',
      importantButtons: [
        { title: 'Read More', content: 'View full blog post and article content' },
        { title: 'Filter by Category', content: 'Find articles by topic (nutrition, training, mindset)' },
      ],
      mainFields: [
        { title: 'Article List', content: 'Browse published blog posts and articles' },
        { title: 'Categories', content: 'Topics like nutrition, training, recovery, mindset' },
        { title: 'Search', content: 'Find specific articles by keyword' },
      ],
      notesAndTips: [
        'Check blog regularly for new tips and updates',
        'Apply advice from articles to your fitness journey',
        'Share helpful articles with friends',
      ],
    },
    ar: {
      pageTitle: 'المدونة والمقالات',
      pageExplanation: 'اقرأ نصائح اللياقة، نصائح التغذية، قصص النجاح، ورؤى الخبراء من المدربين ومجتمع اللياقة.',
      importantButtons: [
        { title: 'اقرأ المزيد', content: 'اعرض المحتوى الكامل للمقالة والمدونة' },
        { title: 'فلتر حسب الفئة', content: 'ابحث عن مقالات حسب الموضوع (التغذية، التدريب، العقلية)' },
      ],
      mainFields: [
        { title: 'قائمة المقالات', content: 'تصفح منشورات المدونة والمقالات المنشورة' },
        { title: 'الفئات', content: 'موضوعات مثل التغذية، التدريب، التعافي، العقلية' },
        { title: 'البحث', content: 'ابحث عن مقالات محددة بالكلمات الرئيسية' },
      ],
      notesAndTips: [
        'تحقق من المدونة بانتظام للحصول على نصائح وتحديثات جديدة',
        'طبق النصائح من المقالات على رحلة لياقتك',
        'شارك المقالات المفيدة مع الأصدقاء',
      ],
    },
  },
  '/': {
    en: {
      pageTitle: 'Welcome Home',
      pageExplanation: 'Your starting point for fitness success. This is where your journey begins - explore features, get started, or log in to your account.',
      importantButtons: [
        { title: 'Get Started', content: 'Begin your fitness journey by creating an account' },
        { title: 'Login', content: 'Access your existing account' },
        { title: 'Learn More', content: 'Discover platform features and pricing' },
      ],
      notesAndTips: [
        'Create an account to access all features',
        'Check out the pricing plans to find what suits you best',
        'Contact support if you need help getting started',
      ],
    },
    ar: {
      pageTitle: 'مرحباً بك',
      pageExplanation: 'نقطة البداية لنجاح لياقتك. هنا تبدأ رحلتك - استكشف الميزات، ابدأ، أو سجل دخول إلى حسابك.',
      importantButtons: [
        { title: 'ابدأ الآن', content: 'ابدأ رحلة لياقتك بإنشاء حساب' },
        { title: 'تسجيل الدخول', content: 'الوصول إلى حسابك الحالي' },
        { title: 'تعرف على المزيد', content: 'اكتشف ميزات المنصة والأسعار' },
      ],
      notesAndTips: [
        'أنشئ حساباً للوصول إلى جميع الميزات',
        'تحقق من خطط الأسعار للعثور على ما يناسبك',
        'اتصل بالدعم إذا كنت بحاجة إلى مساعدة للبدء',
      ],
    },
  },
  '/courses': {
    en: {
      pageTitle: 'Courses Marketplace',
      pageExplanation: 'Browse and enroll in fitness and nutrition courses. Discover expert-led content to enhance your knowledge and achieve your health goals.',
      importantButtons: [
        { title: 'Enroll', content: 'Click to enroll in free courses or proceed to checkout for paid courses' },
        { title: 'View Details', content: 'See full course information including lessons, duration, and instructor details' },
        { title: 'Search', content: 'Find courses by title or description using the search bar' },
        { title: 'Filter', content: 'Filter courses by category (fitness, nutrition, wellness, business) and level (beginner, intermediate, advanced)' },
      ],
      mainFields: [
        { title: 'Course Title', content: 'The name of the course' },
        { title: 'Description', content: 'Detailed overview of what you will learn' },
        { title: 'Category', content: 'Course classification: fitness, nutrition, wellness, or business' },
        { title: 'Level', content: 'Difficulty level: beginner, intermediate, or advanced' },
        { title: 'Price', content: 'Course cost (free or paid)' },
        { title: 'Instructor', content: 'The expert teaching the course' },
        { title: 'Enrollment Status', content: 'Shows if you are already enrolled' },
      ],
      notesAndTips: [
        'Browse courses by category to find content relevant to your goals',
        'Check the level to ensure the course matches your experience',
        'Free courses are a great way to get started',
        'Paid courses often include more detailed content and certifications',
        'You can view your enrolled courses from your dashboard',
      ],
    },
    ar: {
      pageTitle: 'سوق الدورات',
      pageExplanation: 'تصفح وسجل في دورات اللياقة والتغذية. اكتشف محتوى يقوده خبراء لتعزيز معرفتك وتحقيق أهدافك الصحية.',
      importantButtons: [
        { title: 'التسجيل', content: 'انقر للتسجيل في الدورات المجانية أو المتابعة للدفع للدورات المدفوعة' },
        { title: 'عرض التفاصيل', content: 'شاهد معلومات الدورة الكاملة بما في ذلك الدروس والمدة وتفاصيل المدرب' },
        { title: 'البحث', content: 'ابحث عن الدورات بالعنوان أو الوصف باستخدام شريط البحث' },
        { title: 'التصفية', content: 'صفي الدورات حسب الفئة (لياقة، تغذية، عافية، أعمال) والمستوى (مبتدئ، متوسط، متقدم)' },
      ],
      mainFields: [
        { title: 'عنوان الدورة', content: 'اسم الدورة' },
        { title: 'الوصف', content: 'نظرة عامة مفصلة على ما ستتعلمه' },
        { title: 'الفئة', content: 'تصنيف الدورة: لياقة، تغذية، عافية، أو أعمال' },
        { title: 'المستوى', content: 'مستوى الصعوبة: مبتدئ، متوسط، أو متقدم' },
        { title: 'السعر', content: 'تكلفة الدورة (مجانية أو مدفوعة)' },
        { title: 'المدرب', content: 'الخبير الذي يدرس الدورة' },
        { title: 'حالة التسجيل', content: 'يظهر إذا كنت مسجلاً بالفعل' },
      ],
      notesAndTips: [
        'تصفح الدورات حسب الفئة للعثور على محتوى ذي صلة بأهدافك',
        'تحقق من المستوى للتأكد من أن الدورة تتناسب مع خبرتك',
        'الدورات المجانية طريقة رائعة للبدء',
        'الدورات المدفوعة غالباً ما تتضمن محتوى أكثر تفصيلاً وشهادات',
        'يمكنك عرض الدورات المسجلة فيها من لوحة التحكم الخاصة بك',
      ],
    },
  },
  '/supplements': {
    en: {
      pageTitle: 'Supplement Tracking',
      pageExplanation: 'Track and manage your supplement recommendations from your coach. View dosage instructions, timing, and follow-up recommendations to support your fitness journey.',
      importantButtons: [
        { title: 'View User Supplements', content: 'See your current supplement regimen assigned by your coach' },
        { title: 'Follow-up Recommendations', content: 'Check follow-up supplement suggestions based on your progress' },
      ],
      mainFields: [
        { title: 'Supplement Name', content: 'The name of the supplement' },
        { title: 'Dosage', content: 'How much to take (e.g., 1 capsule, 500mg)' },
        { title: 'Dosage Unit', content: 'Unit of measurement (capsules, tablets, mg, etc.)' },
        { title: 'Timing', content: 'When to take it (with meals, specific time of day, etc.)' },
        { title: 'Dosage Amount', content: 'Numeric quantity per dose' },
      ],
      notesAndTips: [
        'Always follow your coach\'s supplement recommendations',
        'Take supplements at the recommended times for best results',
        'Track your supplement intake consistently',
        'Consult with your coach before making any changes to your supplement regimen',
        'Report any side effects or concerns to your coach immediately',
      ],
    },
    ar: {
      pageTitle: 'تتبع المكملات الغذائية',
      pageExplanation: 'تتبع وإدارة توصيات المكملات الغذائية من مدربك. اعرض تعليمات الجرعة والتوقيت والتوصيات المتابعة لدعم رحلة لياقتك.',
      importantButtons: [
        { title: 'عرض مكملات المستخدم', content: 'شاهد نظام المكملات الحالي المعين من مدربك' },
        { title: 'توصيات المتابعة', content: 'تحقق من اقتراحات المكملات المتابعة بناءً على تقدمك' },
      ],
      mainFields: [
        { title: 'اسم المكمل', content: 'اسم المكمل الغذائي' },
        { title: 'الجرعة', content: 'كم تأخذ (مثل 1 كبسولة، 500 ملغ)' },
        { title: 'وحدة الجرعة', content: 'وحدة القياس (كبسولات، أقراص، ملغ، إلخ)' },
        { title: 'التوقيت', content: 'متى تأخذها (مع الوجبات، وقت محدد من اليوم، إلخ)' },
        { title: 'كمية الجرعة', content: 'الكمية الرقمية لكل جرعة' },
      ],
      notesAndTips: [
        'اتبع دائماً توصيات المكملات من مدربك',
        'تناول المكملات في الأوقات الموصى بها للحصول على أفضل النتائج',
        'تتبع تناول المكملات باستمرار',
        'استشر مدربك قبل إجراء أي تغييرات على نظام المكملات',
        'أبلغ عن أي آثار جانبية أو مخاوف لمدربك فوراً',
      ],
    },
  },
  '/alerts': {
    en: {
      pageTitle: 'Alerts Center',
      pageExplanation: 'Stay informed with all your notifications in one place. View system alerts, activity notifications, and important messages related to your fitness journey.',
      importantButtons: [
        { title: 'View Alert', content: 'Click on any alert to see full details' },
        { title: 'Mark as Read', content: 'Mark notifications as read to keep your inbox organized' },
        { title: 'Filter', content: 'Filter alerts by type or date' },
      ],
      mainFields: [
        { title: 'Alert Type', content: 'Category of the notification (system, activity, message)' },
        { title: 'Message', content: 'The alert content' },
        { title: 'Timestamp', content: 'When the alert was created' },
        { title: 'Status', content: 'Read or unread status' },
      ],
      notesAndTips: [
        'Check your alerts regularly to stay updated on important events',
        'System alerts contain important platform updates and maintenance notices',
        'Activity notifications keep you informed about your progress and achievements',
        'Mark alerts as read to keep track of what you\'ve reviewed',
      ],
    },
    ar: {
      pageTitle: 'مركز التنبيهات',
      pageExplanation: 'ابق على اطلاع بجميع إشعاراتك في مكان واحد. اعرض تنبيهات النظام وإشعارات النشاط والرسائل المهمة المتعلقة برحلة لياقتك.',
      importantButtons: [
        { title: 'عرض التنبيه', content: 'انقر على أي تنبيه لرؤية التفاصيل الكاملة' },
        { title: 'وضع علامة كمقروء', content: 'ضع علامة على الإشعارات كمقروءة للحفاظ على صندوق الوارد منظماً' },
        { title: 'التصفية', content: 'صفي التنبيهات حسب النوع أو التاريخ' },
      ],
      mainFields: [
        { title: 'نوع التنبيه', content: 'فئة الإشعار (نظام، نشاط، رسالة)' },
        { title: 'الرسالة', content: 'محتوى التنبيه' },
        { title: 'الطابع الزمني', content: 'وقت إنشاء التنبيه' },
        { title: 'الحالة', content: 'حالة القراءة أو عدم القراءة' },
      ],
      notesAndTips: [
        'تحقق من تنبيهاتك بانتظام للبقاء على اطلاع بالأحداث المهمة',
        'تحتوي تنبيهات النظام على تحديثات مهمة للمنصة وإشعارات الصيانة',
        'تبقيك إشعارات النشاط على اطلاع بتقدمك وإنجازاتك',
        'ضع علامة على التنبيهات كمقروءة لتتبع ما راجعته',
      ],
    },
  },
  '/files-reports': {
    en: {
      pageTitle: 'Files & Reports Manager',
      pageExplanation: 'Store, manage, and organize your health files and medical reports. Upload lab results, assessments, and scans to keep all your health documents in one secure place.',
      importantButtons: [
        { title: 'Upload File', content: 'Upload health reports, lab results, or medical documents' },
        { title: 'Download', content: 'Download your uploaded files for offline access' },
        { title: 'View Details', content: 'See file metadata including size, type, and upload date' },
        { title: 'Delete', content: 'Remove files you no longer need' },
      ],
      mainFields: [
        { title: 'File Name', content: 'The name of your uploaded document' },
        { title: 'File Type', content: 'Category: lab test, assessment, scan, or other' },
        { title: 'File Size', content: 'Size of the document in KB or MB' },
        { title: 'Upload Date', content: 'When the file was uploaded' },
        { title: 'Scan Status', content: 'Virus scan status to ensure file safety' },
        { title: 'MIME Type', content: 'File format (PDF, image, etc.)' },
      ],
      notesAndTips: [
        'All uploaded files are automatically scanned for viruses',
        'Organize your files by type for easy access',
        'Keep your medical reports up to date for your coach to review',
        'Download important files as backups',
        'Supported formats include PDF, images (JPG, PNG), and documents',
      ],
    },
    ar: {
      pageTitle: 'مدير الملفات والتقارير',
      pageExplanation: 'تخزين وإدارة وتنظيم ملفاتك الصحية والتقارير الطبية. ارفع نتائج المختبر والتقييمات والمسح الضوئي للحفاظ على جميع مستنداتك الصحية في مكان واحد آمن.',
      importantButtons: [
        { title: 'رفع ملف', content: 'ارفع التقارير الصحية أو نتائج المختبر أو المستندات الطبية' },
        { title: 'تحميل', content: 'حمل ملفاتك المرفوعة للوصول دون اتصال بالإنترنت' },
        { title: 'عرض التفاصيل', content: 'شاهد بيانات الملف الوصفية بما في ذلك الحجم والنوع وتاريخ الرفع' },
        { title: 'حذف', content: 'أزل الملفات التي لم تعد بحاجة إليها' },
      ],
      mainFields: [
        { title: 'اسم الملف', content: 'اسم المستند المرفوع' },
        { title: 'نوع الملف', content: 'الفئة: اختبار معملي، تقييم، مسح ضوئي، أو آخر' },
        { title: 'حجم الملف', content: 'حجم المستند بالكيلوبايت أو الميجابايت' },
        { title: 'تاريخ الرفع', content: 'وقت رفع الملف' },
        { title: 'حالة المسح', content: 'حالة فحص الفيروسات لضمان سلامة الملف' },
        { title: 'نوع MIME', content: 'تنسيق الملف (PDF، صورة، إلخ)' },
      ],
      notesAndTips: [
        'يتم فحص جميع الملفات المرفوعة تلقائياً بحثاً عن الفيروسات',
        'نظم ملفاتك حسب النوع لسهولة الوصول',
        'حافظ على تحديث تقاريرك الطبية لمراجعة مدربك',
        'حمل الملفات المهمة كنسخ احتياطية',
        'التنسيقات المدعومة تشمل PDF والصور (JPG، PNG) والمستندات',
      ],
    },
  },
  '/community': {
    en: {
      pageTitle: 'Community Challenges',
      pageExplanation: 'Join or create fitness challenges with other users. Compete in step counts, workouts, nutrition goals, weight loss, and more. Track your progress and climb the leaderboards.',
      importantButtons: [
        { title: 'Create Challenge', content: 'Start a new challenge for yourself or invite others to join' },
        { title: 'Join Challenge', content: 'Participate in active challenges created by others' },
        { title: 'View Leaderboard', content: 'See rankings and track who\'s leading the challenge' },
        { title: 'Track Progress', content: 'Monitor your progress toward the challenge target' },
        { title: 'Filter Challenges', content: 'View active, upcoming, or completed challenges' },
      ],
      mainFields: [
        { title: 'Challenge Name', content: 'The title of the challenge' },
        { title: 'Challenge Type', content: 'Category: step count, workouts, nutrition, weight loss, or custom' },
        { title: 'Metric', content: 'What is being tracked (steps, workouts completed, calories, etc.)' },
        { title: 'Target Value', content: 'The goal to achieve' },
        { title: 'Start Date', content: 'When the challenge begins' },
        { title: 'End Date', content: 'Challenge deadline' },
        { title: 'Current Progress', content: 'Your progress shown with a progress bar' },
        { title: 'Visibility', content: 'Public or private challenge' },
      ],
      notesAndTips: [
        'Join challenges to stay motivated and accountable',
        'Compete with friends for extra motivation',
        'Earn badges and medals for completing challenges',
        'Set realistic targets for better success rates',
        'Track multiple challenges simultaneously',
        'Private challenges are great for small groups or personal goals',
      ],
    },
    ar: {
      pageTitle: 'تحديات المجتمع',
      pageExplanation: 'انضم أو أنشئ تحديات لياقة مع مستخدمين آخرين. تنافس في عدد الخطوات والتمارين وأهداف التغذية وفقدان الوزن والمزيد. تتبع تقدمك واصعد على لوحات المتصدرين.',
      importantButtons: [
        { title: 'إنشاء تحدي', content: 'ابدأ تحدياً جديداً لنفسك أو ادع الآخرين للانضمام' },
        { title: 'الانضمام للتحدي', content: 'شارك في التحديات النشطة التي أنشأها الآخرون' },
        { title: 'عرض لوحة المتصدرين', content: 'شاهد الترتيبات وتتبع من يتصدر التحدي' },
        { title: 'تتبع التقدم', content: 'راقب تقدمك نحو هدف التحدي' },
        { title: 'تصفية التحديات', content: 'اعرض التحديات النشطة أو القادمة أو المكتملة' },
      ],
      mainFields: [
        { title: 'اسم التحدي', content: 'عنوان التحدي' },
        { title: 'نوع التحدي', content: 'الفئة: عدد الخطوات، التمارين، التغذية، فقدان الوزن، أو مخصص' },
        { title: 'المقياس', content: 'ما يتم تتبعه (الخطوات، التمارين المكتملة، السعرات الحرارية، إلخ)' },
        { title: 'القيمة المستهدفة', content: 'الهدف المراد تحقيقه' },
        { title: 'تاريخ البدء', content: 'عندما يبدأ التحدي' },
        { title: 'تاريخ الانتهاء', content: 'الموعد النهائي للتحدي' },
        { title: 'التقدم الحالي', content: 'تقدمك معروض بشريط التقدم' },
        { title: 'الرؤية', content: 'تحدي عام أو خاص' },
      ],
      notesAndTips: [
        'انضم للتحديات للبقاء متحفزاً ومسؤولاً',
        'تنافس مع الأصدقاء لتحفيز إضافي',
        'اكسب شارات وميداليات لإكمال التحديات',
        'ضع أهدافاً واقعية لمعدلات نجاح أفضل',
        'تتبع تحديات متعددة في وقت واحد',
        'التحديات الخاصة رائعة للمجموعات الصغيرة أو الأهداف الشخصية',
      ],
    },
  },
  '/food-search': {
    en: {
      pageTitle: 'Food Database & Nutrition Lookup',
      pageExplanation: 'Search our comprehensive food database to find nutrition information. Look up foods by name in English or Arabic, calculate nutrition based on quantity, and add custom foods to the database.',
      importantButtons: [
        { title: 'Search', content: 'Enter food name to search the database' },
        { title: 'AI Lookup', content: 'Use AI to find nutrition info for foods not in the database' },
        { title: 'Add Food', content: 'Manually add a new food with complete nutrition details' },
        { title: 'Calculate Nutrition', content: 'Adjust quantity (in grams) to see updated nutrition values' },
      ],
      mainFields: [
        { title: 'Food Name', content: 'Name in English and/or Arabic' },
        { title: 'Brand', content: 'Product brand name (if applicable)' },
        { title: 'Calories', content: 'Energy content per serving' },
        { title: 'Protein', content: 'Protein content in grams' },
        { title: 'Carbohydrates', content: 'Total carbs in grams' },
        { title: 'Fats', content: 'Total fat content in grams' },
        { title: 'Fiber', content: 'Dietary fiber in grams' },
        { title: 'Serving Size', content: 'Standard serving size in grams' },
        { title: 'Category', content: 'Food classification' },
      ],
      notesAndTips: [
        'Search in your preferred language - the database supports both English and Arabic',
        'If a food isn\'t found, try the AI lookup feature for instant results',
        'You can add custom foods for items not in the database',
        'Adjust the quantity to calculate nutrition for your exact serving size',
        'The database includes thousands of common foods and branded products',
        'Nutrition values are calculated per 100g by default, then scaled to your input',
      ],
    },
    ar: {
      pageTitle: 'قاعدة بيانات الطعام والبحث التغذوي',
      pageExplanation: 'ابحث في قاعدة بيانات الطعام الشاملة للعثور على معلومات التغذية. ابحث عن الأطعمة بالاسم باللغة الإنجليزية أو العربية، احسب التغذية بناءً على الكمية، وأضف أطعمة مخصصة إلى قاعدة البيانات.',
      importantButtons: [
        { title: 'البحث', content: 'أدخل اسم الطعام للبحث في قاعدة البيانات' },
        { title: 'البحث بالذكاء الاصطناعي', content: 'استخدم الذكاء الاصطناعي للعثور على معلومات التغذية للأطعمة غير الموجودة في قاعدة البيانات' },
        { title: 'إضافة طعام', content: 'أضف طعاماً جديداً يدوياً بتفاصيل التغذية الكاملة' },
        { title: 'حساب التغذية', content: 'اضبط الكمية (بالجرامات) لرؤية قيم التغذية المحدثة' },
      ],
      mainFields: [
        { title: 'اسم الطعام', content: 'الاسم بالإنجليزية و/أو العربية' },
        { title: 'العلامة التجارية', content: 'اسم العلامة التجارية للمنتج (إن وجد)' },
        { title: 'السعرات الحرارية', content: 'محتوى الطاقة لكل حصة' },
        { title: 'البروتين', content: 'محتوى البروتين بالجرام' },
        { title: 'الكربوهيدرات', content: 'إجمالي الكربوهيدرات بالجرام' },
        { title: 'الدهون', content: 'إجمالي محتوى الدهون بالجرام' },
        { title: 'الألياف', content: 'الألياف الغذائية بالجرام' },
        { title: 'حجم الحصة', content: 'حجم الحصة القياسي بالجرام' },
        { title: 'الفئة', content: 'تصنيف الطعام' },
      ],
      notesAndTips: [
        'ابحث بلغتك المفضلة - قاعدة البيانات تدعم الإنجليزية والعربية',
        'إذا لم يتم العثور على طعام، جرب ميزة البحث بالذكاء الاصطناعي للحصول على نتائج فورية',
        'يمكنك إضافة أطعمة مخصصة للعناصر غير الموجودة في قاعدة البيانات',
        'اضبط الكمية لحساب التغذية لحجم حصتك الدقيق',
        'تتضمن قاعدة البيانات آلاف الأطعمة الشائعة والمنتجات ذات العلامات التجارية',
        'يتم حساب قيم التغذية لكل 100 جرام افتراضياً، ثم تقاس حسب إدخالك',
      ],
    },
  },
  '/taxonomy': {
    en: {
      pageTitle: 'Taxonomy Management',
      pageExplanation: 'Manage system categories and classification structures. Configure category hierarchies for courses, challenges, and other content to keep the platform organized.',
      importantButtons: [
        { title: 'Add Category', content: 'Create a new category or subcategory' },
        { title: 'Edit Category', content: 'Modify category names and properties' },
        { title: 'Delete Category', content: 'Remove unused categories' },
        { title: 'Organize Hierarchy', content: 'Arrange categories in a logical structure' },
      ],
      mainFields: [
        { title: 'Category Name', content: 'The name of the category' },
        { title: 'Parent Category', content: 'The category this belongs under (if any)' },
        { title: 'Description', content: 'Details about what this category contains' },
        { title: 'Status', content: 'Active or inactive' },
      ],
      notesAndTips: [
        'Keep category names clear and descriptive',
        'Use hierarchies to organize related categories',
        'Deactivate categories instead of deleting them to preserve historical data',
        'This is an admin-only feature',
        'Changes to taxonomy affect how content is organized across the platform',
      ],
    },
    ar: {
      pageTitle: 'إدارة التصنيف',
      pageExplanation: 'إدارة فئات النظام وهياكل التصنيف. تكوين التسلسلات الهرمية للفئات للدورات والتحديات والمحتوى الآخر للحفاظ على تنظيم المنصة.',
      importantButtons: [
        { title: 'إضافة فئة', content: 'إنشاء فئة جديدة أو فئة فرعية' },
        { title: 'تحرير الفئة', content: 'تعديل أسماء الفئات والخصائص' },
        { title: 'حذف الفئة', content: 'إزالة الفئات غير المستخدمة' },
        { title: 'تنظيم التسلسل الهرمي', content: 'ترتيب الفئات في هيكل منطقي' },
      ],
      mainFields: [
        { title: 'اسم الفئة', content: 'اسم الفئة' },
        { title: 'الفئة الأم', content: 'الفئة التي تنتمي إليها (إن وجدت)' },
        { title: 'الوصف', content: 'تفاصيل حول ما تحتويه هذه الفئة' },
        { title: 'الحالة', content: 'نشطة أو غير نشطة' },
      ],
      notesAndTips: [
        'اجعل أسماء الفئات واضحة ووصفية',
        'استخدم التسلسلات الهرمية لتنظيم الفئات ذات الصلة',
        'قم بإلغاء تنشيط الفئات بدلاً من حذفها للحفاظ على البيانات التاريخية',
        'هذه ميزة للمسؤولين فقط',
        'التغييرات على التصنيف تؤثر على كيفية تنظيم المحتوى عبر المنصة',
      ],
    },
  },
  '/ads-courses': {
    en: {
      pageTitle: 'Ads Management',
      pageExplanation: 'Manage ad campaigns, top-bar announcements, and shared marketing categories from one module.',
      importantButtons: [
        { title: 'Create Ad', content: 'Start a new ad campaign for the public ads page' },
        { title: 'Create Announcement', content: 'Publish a notice for the top announcement bar' },
        { title: 'Manage Categories', content: 'Maintain shared categories for ads and announcements' },
        { title: 'Enable/Show in Top Bar', content: 'Control top-bar visibility rules' },
      ],
      mainFields: [
        { title: 'Announcement Title (EN/AR)', content: 'Bilingual text rendered in the top bar' },
        { title: 'Category', content: 'Shared marketing category for ads and announcements' },
        { title: 'Status', content: 'Active or inactive state' },
        { title: 'Enabled', content: 'Quick on/off control without deleting' },
        { title: 'Show in Top Bar', content: 'Determines if this item appears in the marquee' },
        { title: 'Sort Order', content: 'Lower values appear first in the scrolling bar' },
      ],
      notesAndTips: [
        'Use concise announcement text for better readability in scrolling mode',
        'Use sort order to prioritize urgent announcements',
        'Keep categories consistent so public filters stay useful',
        'Use ads for evergreen marketing content on the /ads page',
        'This is an admin-only feature',
        'Preview both Arabic and English output before publishing',
      ],
    },
    ar: {
      pageTitle: 'إدارة الإعلانات',
      pageExplanation: 'إدارة الحملات الإعلانية وعناصر شريط الإعلانات العلوي والفئات التسويقية المشتركة من مكان واحد.',
      importantButtons: [
        { title: 'إنشاء إعلان', content: 'بدء حملة إعلانية جديدة لصفحة الإعلانات العامة' },
        { title: 'إنشاء إعلان علوي', content: 'نشر تنبيه في شريط الإعلانات العلوي' },
        { title: 'إدارة الفئات', content: 'إدارة الفئات المشتركة بين الإعلانات والتنبيهات' },
        { title: 'تفعيل/إظهار في الأعلى', content: 'التحكم في الظهور داخل الشريط المتحرك' },
      ],
      mainFields: [
        { title: 'عنوان الإعلان (عربي/إنجليزي)', content: 'نص ثنائي اللغة يظهر في الشريط العلوي' },
        { title: 'الفئة', content: 'فئة تسويقية مشتركة للإعلانات والتنبيهات' },
        { title: 'الحالة', content: 'نشطة أو غير نشطة' },
        { title: 'مفعل', content: 'تشغيل أو إيقاف سريع دون حذف' },
        { title: 'إظهار في الشريط العلوي', content: 'يحدد الظهور داخل الشريط المتحرك' },
        { title: 'ترتيب العرض', content: 'الأرقام الأقل تظهر أولاً' },
      ],
      notesAndTips: [
        'اجعل نص الشريط العلوي قصيرًا لسهولة القراءة أثناء الحركة',
        'استخدم ترتيب العرض لإبراز التنبيهات العاجلة',
        'حافظ على اتساق الفئات لضمان فلاتر عامة دقيقة',
        'استخدم صفحة الإعلانات للمحتوى التسويقي الدائم',
        'هذه ميزة للمسؤولين فقط',
        'راجع العرض بالعربية والإنجليزية قبل النشر',
      ],
    },
  },
  '/manage-courses': {
    en: {
      pageTitle: 'Course Management',
      pageExplanation: 'Create, edit, and manage all courses on the platform. Control course content, lessons, pricing, and publication status. Track enrollments and course performance.',
      importantButtons: [
        { title: 'Create Course', content: 'Start building a new course with the course form' },
        { title: 'Edit Course', content: 'Modify course details, description, and settings' },
        { title: 'Manage Lessons', content: 'Add, edit, or remove lessons within a course' },
        { title: 'Delete Course', content: 'Permanently remove a course' },
        { title: 'Publish/Unpublish', content: 'Control course visibility and availability' },
        { title: 'Mark as Featured', content: 'Highlight popular or important courses' },
      ],
      mainFields: [
        { title: 'Title', content: 'Course name displayed to students' },
        { title: 'Description', content: 'Detailed overview of course content and learning outcomes' },
        { title: 'Category', content: 'Course classification (fitness, nutrition, wellness, business)' },
        { title: 'Level', content: 'Target skill level (beginner, intermediate, advanced)' },
        { title: 'Price', content: 'Course cost (can be free or paid)' },
        { title: 'Status', content: 'Draft, published, or archived' },
        { title: 'Thumbnail', content: 'Course cover image' },
        { title: 'Featured Flag', content: 'Whether to highlight this course' },
        { title: 'Enrollments', content: 'Number of students enrolled' },
        { title: 'Duration', content: 'Total course length' },
        { title: 'Ratings', content: 'Student reviews and ratings' },
      ],
      notesAndTips: [
        'Start with draft status while building your course',
        'Use clear, descriptive titles that communicate value',
        'Add a high-quality thumbnail to attract students',
        'Organize lessons in a logical progression',
        'Set appropriate pricing based on course depth and value',
        'Feature your best courses to boost visibility',
        'Monitor enrollments and ratings to gauge course success',
        'Archive outdated courses instead of deleting them',
      ],
    },
    ar: {
      pageTitle: 'إدارة الدورات',
      pageExplanation: 'إنشاء وتحرير وإدارة جميع الدورات على المنصة. التحكم في محتوى الدورة والدروس والتسعير وحالة النشر. تتبع التسجيلات وأداء الدورة.',
      importantButtons: [
        { title: 'إنشاء دورة', content: 'ابدأ في بناء دورة جديدة باستخدام نموذج الدورة' },
        { title: 'تحرير الدورة', content: 'تعديل تفاصيل الدورة والوصف والإعدادات' },
        { title: 'إدارة الدروس', content: 'إضافة أو تحرير أو إزالة الدروس داخل الدورة' },
        { title: 'حذف الدورة', content: 'إزالة الدورة بشكل دائم' },
        { title: 'نشر/إلغاء النشر', content: 'التحكم في رؤية الدورة وتوافرها' },
        { title: 'وضع علامة كمميزة', content: 'تسليط الضوء على الدورات الشعبية أو المهمة' },
      ],
      mainFields: [
        { title: 'العنوان', content: 'اسم الدورة المعروض للطلاب' },
        { title: 'الوصف', content: 'نظرة عامة مفصلة على محتوى الدورة ونتائج التعلم' },
        { title: 'الفئة', content: 'تصنيف الدورة (لياقة، تغذية، عافية، أعمال)' },
        { title: 'المستوى', content: 'مستوى المهارة المستهدف (مبتدئ، متوسط، متقدم)' },
        { title: 'السعر', content: 'تكلفة الدورة (يمكن أن تكون مجانية أو مدفوعة)' },
        { title: 'الحالة', content: 'مسودة، منشورة، أو مؤرشفة' },
        { title: 'الصورة المصغرة', content: 'صورة غلاف الدورة' },
        { title: 'علامة المميزة', content: 'ما إذا كان سيتم تسليط الضوء على هذه الدورة' },
        { title: 'التسجيلات', content: 'عدد الطلاب المسجلين' },
        { title: 'المدة', content: 'إجمالي مدة الدورة' },
        { title: 'التقييمات', content: 'مراجعات وتقييمات الطلاب' },
      ],
      notesAndTips: [
        'ابدأ بحالة المسودة أثناء بناء دورتك',
        'استخدم عناوين واضحة ووصفية تنقل القيمة',
        'أضف صورة مصغرة عالية الجودة لجذب الطلاب',
        'نظم الدروس في تسلسل منطقي',
        'حدد التسعير المناسب بناءً على عمق الدورة وقيمتها',
        'أبرز أفضل دوراتك لزيادة الرؤية',
        'راقب التسجيلات والتقييمات لقياس نجاح الدورة',
        'أرشف الدورات القديمة بدلاً من حذفها',
      ],
    },
  },
  '/manage-orders': {
    en: {
      pageTitle: 'Order Management',
      pageExplanation: 'View and manage all customer orders on the platform. Track order status, payment status, and shipping details. Update orders and handle customer requests.',
      importantButtons: [
        { title: 'Search Orders', content: 'Find orders by customer name, order ID, or product' },
        { title: 'Filter by Status', content: 'View orders by status (pending, processing, shipped, delivered, cancelled)' },
        { title: 'Update Order', content: 'Change order status or payment status' },
        { title: 'View Details', content: 'See complete order information including items, quantities, and prices' },
        { title: 'Edit Shipping', content: 'Update shipping address or details when needed' },
        { title: 'View Timeline', content: 'Check order history and status changes' },
      ],
      mainFields: [
        { title: 'Order ID', content: 'Unique identifier for the order' },
        { title: 'Customer Name', content: 'Name of the person who placed the order' },
        { title: 'Order Status', content: 'Current status (pending, processing, shipped, delivered, cancelled)' },
        { title: 'Payment Status', content: 'Payment state (paid, pending, failed, refunded)' },
        { title: 'Total Amount', content: 'Total order value' },
        { title: 'Order Items', content: 'List of products and quantities ordered' },
        { title: 'Shipping Address', content: 'Delivery location' },
        { title: 'Order Date', content: 'When the order was placed' },
      ],
      notesAndTips: [
        'Keep order statuses updated to inform customers of progress',
        'Check payment status before processing shipments',
        'Use filters to quickly find orders needing attention',
        'View order timeline to track all status changes',
        'Update shipping information carefully to avoid delivery errors',
        'This is an admin-only feature',
        'Respond to customer inquiries by checking order details',
      ],
    },
    ar: {
      pageTitle: 'إدارة الطلبات',
      pageExplanation: 'عرض وإدارة جميع طلبات العملاء على المنصة. تتبع حالة الطلب وحالة الدفع وتفاصيل الشحن. تحديث الطلبات ومعالجة طلبات العملاء.',
      importantButtons: [
        { title: 'البحث عن الطلبات', content: 'ابحث عن الطلبات باسم العميل أو رقم الطلب أو المنتج' },
        { title: 'التصفية حسب الحالة', content: 'عرض الطلبات حسب الحالة (معلق، قيد المعالجة، تم الشحن، تم التسليم، ملغي)' },
        { title: 'تحديث الطلب', content: 'تغيير حالة الطلب أو حالة الدفع' },
        { title: 'عرض التفاصيل', content: 'شاهد معلومات الطلب الكاملة بما في ذلك العناصر والكميات والأسعار' },
        { title: 'تحرير الشحن', content: 'تحديث عنوان الشحن أو التفاصيل عند الحاجة' },
        { title: 'عرض الجدول الزمني', content: 'تحقق من سجل الطلب وتغييرات الحالة' },
      ],
      mainFields: [
        { title: 'رقم الطلب', content: 'المعرف الفريد للطلب' },
        { title: 'اسم العميل', content: 'اسم الشخص الذي قدم الطلب' },
        { title: 'حالة الطلب', content: 'الحالة الحالية (معلق، قيد المعالجة، تم الشحن، تم التسليم، ملغي)' },
        { title: 'حالة الدفع', content: 'حالة الدفع (مدفوع، معلق، فشل، مسترد)' },
        { title: 'المبلغ الإجمالي', content: 'قيمة الطلب الإجمالية' },
        { title: 'عناصر الطلب', content: 'قائمة المنتجات والكميات المطلوبة' },
        { title: 'عنوان الشحن', content: 'موقع التسليم' },
        { title: 'تاريخ الطلب', content: 'عندما تم تقديم الطلب' },
      ],
      notesAndTips: [
        'حافظ على تحديث حالات الطلبات لإعلام العملاء بالتقدم',
        'تحقق من حالة الدفع قبل معالجة الشحنات',
        'استخدم الفلاتر للعثور بسرعة على الطلبات التي تحتاج إلى اهتمام',
        'عرض الجدول الزمني للطلب لتتبع جميع تغييرات الحالة',
        'قم بتحديث معلومات الشحن بعناية لتجنب أخطاء التسليم',
        'هذه ميزة للمسؤولين فقط',
        'رد على استفسارات العملاء بفحص تفاصيل الطلب',
      ],
    },
  },
  '/tenant': {
    en: {
      pageTitle: 'Tenant Operations',
      pageExplanation: 'Manage multi-tenant platform operations and configurations. Control tenant-specific settings, white-label instances, and customer tenant management for your SaaS platform.',
      importantButtons: [
        { title: 'Create Tenant', content: 'Set up a new tenant instance with custom configuration' },
        { title: 'Edit Tenant', content: 'Modify tenant settings and properties' },
        { title: 'View Analytics', content: 'See tenant usage statistics and metrics' },
        { title: 'Manage Subscriptions', content: 'Control tenant billing and subscription plans' },
      ],
      mainFields: [
        { title: 'Tenant Name', content: 'Name of the tenant organization' },
        { title: 'Subdomain', content: 'Custom subdomain for the tenant' },
        { title: 'Status', content: 'Active, suspended, or trial' },
        { title: 'Subscription Plan', content: 'Current billing plan' },
        { title: 'User Count', content: 'Number of users under this tenant' },
        { title: 'Created Date', content: 'When the tenant was created' },
      ],
      notesAndTips: [
        'This feature is only available on the main domain (not tenant subdomains)',
        'Each tenant has isolated data and custom branding',
        'Monitor tenant usage to ensure fair resource allocation',
        'Suspend tenants for billing issues or policy violations',
        'This is an admin-only feature for platform operators',
      ],
    },
    ar: {
      pageTitle: 'عمليات المستأجرين',
      pageExplanation: 'إدارة عمليات وتكوينات المنصة متعددة المستأجرين. التحكم في الإعدادات الخاصة بالمستأجرين ومثيلات العلامة البيضاء وإدارة مستأجري العملاء لمنصة SaaS الخاصة بك.',
      importantButtons: [
        { title: 'إنشاء مستأجر', content: 'إعداد مثيل مستأجر جديد بتكوين مخصص' },
        { title: 'تحرير المستأجر', content: 'تعديل إعدادات وخصائص المستأجر' },
        { title: 'عرض التحليلات', content: 'شاهد إحصائيات ومقاييس استخدام المستأجر' },
        { title: 'إدارة الاشتراكات', content: 'التحكم في الفواتير وخطط الاشتراك للمستأجر' },
      ],
      mainFields: [
        { title: 'اسم المستأجر', content: 'اسم منظمة المستأجر' },
        { title: 'النطاق الفرعي', content: 'النطاق الفرعي المخصص للمستأجر' },
        { title: 'الحالة', content: 'نشط، معلق، أو تجريبي' },
        { title: 'خطة الاشتراك', content: 'خطة الفوترة الحالية' },
        { title: 'عدد المستخدمين', content: 'عدد المستخدمين تحت هذا المستأجر' },
        { title: 'تاريخ الإنشاء', content: 'عندما تم إنشاء المستأجر' },
      ],
      notesAndTips: [
        'هذه الميزة متاحة فقط على النطاق الرئيسي (وليس النطاقات الفرعية للمستأجرين)',
        'كل مستأجر لديه بيانات معزولة وعلامة تجارية مخصصة',
        'راقب استخدام المستأجر لضمان تخصيص الموارد العادل',
        'علق المستأجرين لمشاكل الفوترة أو انتهاكات السياسة',
        'هذه ميزة للمسؤولين فقط لمشغلي المنصة',
      ],
    },
  },
  '/security': {
    en: {
      pageTitle: 'Security Operations',
      pageExplanation: 'Configure and manage security settings for the platform. Control access policies, API keys, user permissions, security logs, and audit settings to protect your application.',
      importantButtons: [
        { title: 'Manage API Keys', content: 'Create, revoke, or rotate API keys for integrations' },
        { title: 'Configure Policies', content: 'Set password policies, session timeouts, and access rules' },
        { title: 'View Security Logs', content: 'Review audit logs and security events' },
        { title: 'Manage Permissions', content: 'Control role-based access control (RBAC) settings' },
        { title: 'Enable 2FA', content: 'Configure two-factor authentication requirements' },
      ],
      mainFields: [
        { title: 'API Keys', content: 'Active API keys and their permissions' },
        { title: 'Password Policy', content: 'Requirements for password strength and rotation' },
        { title: 'Session Timeout', content: 'Automatic logout duration' },
        { title: 'Access Rules', content: 'IP whitelist/blacklist and access restrictions' },
        { title: 'Audit Logs', content: 'Security event history and user actions' },
        { title: '2FA Status', content: 'Two-factor authentication configuration' },
      ],
      notesAndTips: [
        'Regularly rotate API keys for security',
        'Enforce strong password policies to protect user accounts',
        'Review security logs frequently for suspicious activity',
        'Enable two-factor authentication for all admin accounts',
        'Set appropriate session timeouts based on security needs',
        'This is an admin-only feature',
        'Backup security configurations before making changes',
      ],
    },
    ar: {
      pageTitle: 'عمليات الأمان',
      pageExplanation: 'تكوين وإدارة إعدادات الأمان للمنصة. التحكم في سياسات الوصول ومفاتيح API وأذونات المستخدم وسجلات الأمان وإعدادات التدقيق لحماية تطبيقك.',
      importantButtons: [
        { title: 'إدارة مفاتيح API', content: 'إنشاء أو إلغاء أو تدوير مفاتيح API للتكاملات' },
        { title: 'تكوين السياسات', content: 'تعيين سياسات كلمة المرور ومهلات الجلسة وقواعد الوصول' },
        { title: 'عرض سجلات الأمان', content: 'مراجعة سجلات التدقيق وأحداث الأمان' },
        { title: 'إدارة الأذونات', content: 'التحكم في إعدادات التحكم في الوصول القائم على الأدوار (RBAC)' },
        { title: 'تفعيل المصادقة الثنائية', content: 'تكوين متطلبات المصادقة الثنائية' },
      ],
      mainFields: [
        { title: 'مفاتيح API', content: 'مفاتيح API النشطة وأذوناتها' },
        { title: 'سياسة كلمة المرور', content: 'متطلبات قوة كلمة المرور والتدوير' },
        { title: 'مهلة الجلسة', content: 'مدة تسجيل الخروج التلقائي' },
        { title: 'قواعد الوصول', content: 'القائمة البيضاء/السوداء لعناوين IP وقيود الوصول' },
        { title: 'سجلات التدقيق', content: 'سجل أحداث الأمان وإجراءات المستخدم' },
        { title: 'حالة المصادقة الثنائية', content: 'تكوين المصادقة الثنائية' },
      ],
      notesAndTips: [
        'قم بتدوير مفاتيح API بانتظام للأمان',
        'فرض سياسات كلمة مرور قوية لحماية حسابات المستخدمين',
        'راجع سجلات الأمان بشكل متكرر للنشاط المشبوه',
        'فعّل المصادقة الثنائية لجميع حسابات المسؤولين',
        'اضبط مهلات الجلسة المناسبة بناءً على احتياجات الأمان',
        'هذه ميزة للمسؤولين فقط',
        'احتفظ بنسخة احتياطية من تكوينات الأمان قبل إجراء التغييرات',
      ],
    },
  },
};

// Helper function to get guide content for current page
export function getGuideForPage(pathname: string, language: 'en' | 'ar'): PageGuide | null {
  // Normalize the path to match our keys
  const normalizedPath = pathname === '/' ? '/' : pathname.split('?')[0];
  
  // Try exact match first
  if (guideContent[normalizedPath as PagePath]) {
    return guideContent[normalizedPath as PagePath][language];
  }
  
  // Try to find a matching base path (e.g., /product/123 -> /store)
  const basePath = '/' + normalizedPath.split('/')[1];
  if (guideContent[basePath as PagePath]) {
    return guideContent[basePath as PagePath][language];
  }
  
  // Default fallback - return dashboard guide
  return guideContent['/dashboard'][language];
}
