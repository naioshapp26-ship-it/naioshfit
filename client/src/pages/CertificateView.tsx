import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download, Printer, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import html2canvas from "html2canvas";

export default function CertificateView() {
  const [, params] = useRoute("/certificates/:certId");
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  
  // Extract certificate ID from the path (e.g., CERT-11-88-1769075915 from /certificates/CERT-11-88-1769075915.pdf)
  const certId = params?.certId?.replace('.pdf', '');
  
  // Parse certificate ID to extract course and user IDs
  const parseCertId = (id: string) => {
    // Format: CERT-{courseId}-{userId}-{timestamp}
    const parts = id?.split('-');
    if (parts && parts.length >= 4) {
      return {
        courseId: parseInt(parts[1]),
        userId: parseInt(parts[2]),
        timestamp: parts[3]
      };
    }
    return null;
  };

  // Parse query params from the browser location to reliably support direct URL opens.
  const rawSearch = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
  // Backward compatibility: recover malformed query strings like `courseId=25?user=119&cert=8`.
  const normalizedSearch = rawSearch.replace(/\?([a-zA-Z0-9_-]+)=/g, "&$1=");
  const searchParams = new URLSearchParams(normalizedSearch);
  const shouldAutoDownload = searchParams.get("download") === "1";
  
  // Try to get certInfo from tenant format first, then fall back to query params
  const certInfo = certId ? parseCertId(certId) : null;
  const courseIdFromQuery = searchParams.get("courseId");
  const userIdFromQuery = searchParams.get("user");
  const certIdFromQuery = searchParams.get("cert");
  
  // Determine the courseId to fetch - prefer parsed tenant format, fallback to query params
  const effectiveCourseId = certInfo?.courseId || (courseIdFromQuery ? parseInt(courseIdFromQuery) : null);
  const effectiveUserId = certInfo?.userId || (userIdFromQuery ? parseInt(userIdFromQuery) : null);
  const effectiveCertId = certIdFromQuery ? parseInt(certIdFromQuery) : null;

  // Fetch certificate details
  const { data: certificate, isLoading } = useQuery({
    queryKey: ['/api/user/certificates', effectiveCourseId, effectiveUserId, effectiveCertId],
    queryFn: async () => {
      const response = await fetch('/api/user/certificates', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch certificates');
      const certs = await response.json();
      // Find the specific certificate by courseId or certificateId
      return certs.find((c: any) => {
        if (effectiveCertId) {
          // Match by certificate ID if available
          return c.certificateId === effectiveCertId || c.id === effectiveCertId;
        }
        // Otherwise match by courseId
        return c.courseId === effectiveCourseId;
      });
    },
    enabled: !!(effectiveCourseId || effectiveCertId)
  });

  const handleDownload = async () => {
    if (!certificateRef.current) return;
    
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `certificate-${certificate?.course?.title || 'course'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading certificate:', error);
    }
  };

  useEffect(() => {
    if (!shouldAutoDownload || autoDownloaded || !certificate) return;
    setAutoDownloaded(true);
    void handleDownload();
  }, [shouldAutoDownload, autoDownloaded, certificate]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Certificate Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The certificate you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/courses')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  const courseName = language === "ar" && certificate.course?.titleAr 
    ? certificate.course.titleAr 
    : certificate.course?.title || "Course Completion";
  
  const issueDate = certificate.issuedAt 
    ? new Date(certificate.issuedAt).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : new Date().toLocaleDateString();

  const userName = certificate.user?.firstName && certificate.user?.lastName
    ? `${certificate.user.firstName} ${certificate.user.lastName}`
    : certificate.user?.username || "Student";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      {/* Action Bar - Hidden during print */}
      <div className="max-w-5xl mx-auto mb-6 print:hidden">
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate('/courses')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "العودة" : "Back"}
          </Button>
          <Button className="bg-red-800 text-white hover:bg-red-900" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
          <Button className="bg-red-800 text-white hover:bg-red-900" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحميل" : "Download"}
          </Button>
        </div>
      </div>

      {/* Certificate */}
      <div className="max-w-5xl mx-auto" ref={certificateRef}>
        <div className="bg-white shadow-2xl rounded-lg overflow-hidden border-8 border-double border-primary/20">
          {/* Decorative Header */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 h-4"></div>
          
          {/* Certificate Content */}
          <div className="p-12 md:p-16 relative">
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
              <svg className="w-96 h-96" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>

            {/* Certificate Header */}
            <div className="text-center mb-8 relative z-10">
              <div className="inline-block">
                <svg className="w-20 h-20 mx-auto mb-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <h1 className="text-[calc(1.525rem+3.3vw)] font-serif font-bold text-gray-800 mb-2">
                {language === "ar" ? "شهادة الإتمام" : "Certificate of Completion"}
              </h1>
              <div className="w-32 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 mx-auto rounded-full"></div>
            </div>

            {/* Certificate Body */}
            <div className="text-center space-y-6 relative z-10">
              <p className="text-lg text-gray-600 font-light">
                {language === "ar" ? "هذه الشهادة تُمنح لـ" : "This is to certify that"}
              </p>

              <div className="my-8">
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">
                  {userName}
                </h2>
                <div className="w-64 h-0.5 bg-gray-300 mx-auto mt-2"></div>
              </div>

              <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
                {language === "ar" 
                  ? "أكمل بنجاح جميع متطلبات الدورة"
                  : "has successfully completed all requirements for the course"
                }
              </p>

              <div className="my-8 py-8">
                <h3 className="text-2xl md:text-3xl font-serif font-bold text-gray-800 mb-4">
                  {courseName}
                </h3>
                {certificate.course?.description && (
                  <p className="text-sm text-gray-500 max-w-xl mx-auto">
                    {language === "ar" && certificate.course.descriptionAr 
                      ? certificate.course.descriptionAr 
                      : certificate.course.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 pt-8">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    {language === "ar" ? "تاريخ الإصدار" : "Date of Issue"}
                  </p>
                  <p className="text-lg font-semibold text-gray-700">{issueDate}</p>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    {language === "ar" ? "رقم الشهادة" : "Certificate Number"}
                  </p>
                  <p className="text-lg font-mono font-semibold text-gray-700">
                    {certId}
                  </p>
                </div>
              </div>

              {/* Instructor Signature (if available) */}
              {certificate.course?.instructor && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <div className="flex justify-center items-end gap-4">
                    <div className="text-center">
                      <div className="w-48 h-0.5 bg-gray-400 mb-2"></div>
                      <p className="text-sm text-gray-600">
                        {certificate.course.instructor.firstName} {certificate.course.instructor.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {language === "ar" ? "المدرب" : "Instructor"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Decorative Corner Elements */}
            <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-primary/30 rounded-tl-lg"></div>
            <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-primary/30 rounded-tr-lg"></div>
            <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-primary/30 rounded-bl-lg"></div>
            <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-primary/30 rounded-br-lg"></div>
          </div>

          {/* Decorative Footer */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 h-4"></div>
        </div>

        {/* Verification Footer */}
        <div className="text-center mt-6 text-sm text-gray-500 print:hidden">
          <p>{language === "ar" ? "شهادة موثقة من" : "Verified certificate from"} Naiosh Fit</p>
          <p className="text-xs mt-1">
            {language === "ar" 
              ? "يمكن التحقق من صحة هذه الشهادة" 
              : "This certificate can be verified at"
            } {window.location.href}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}
